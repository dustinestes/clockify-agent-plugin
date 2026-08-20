#!/usr/bin/env node
/**
 * Maintainer DX helper for Run and Debug → Sandbox.
 * Wraps existing install:cursor --sandbox flags; does not change that CLI.
 *
 *   npm run sandbox:debug              # build, create, keep-alive until Stop/Ctrl+C/window close
 *   npm run sandbox:teardown           # confirm, then --sandbox --teardown
 *   npm run sandbox:teardown -- --force  # no prompt (postDebugTask / Stop cleanup)
 *
 * Opens the sandbox with cursor/code --new-window --wait (detached process
 * group so Ctrl+C hits this script only). Closing that window ends the wait
 * and triggers teardown. Stop force-tears down (session already over);
 * Ctrl+C confirms so you can keep the live sandbox.
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";
import { stdin as input, stdout as output } from "node:process";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sandboxRoot = join(tmpdir(), "clockify-agent-plugin-sandbox");

function runNpm(args) {
  const result = spawnSync("npm", args, {
    cwd: root,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

/** @returns {{ bin: string, child: import("node:child_process").ChildProcess } | null} */
function openSandboxWindow(path) {
  for (const bin of ["cursor", "code"]) {
    const probe = spawnSync(bin, ["--version"], {
      stdio: "ignore",
      shell: process.platform === "win32",
    });
    if (probe.error || (probe.status !== 0 && probe.status !== null)) {
      continue;
    }
    const child = spawn(bin, ["--new-window", "--wait", path], {
      stdio: "ignore",
      // Own process group: terminal Ctrl+C must not SIGINT the wait tree
      // (that raced our confirm prompt and looked like "window closed").
      detached: true,
      shell: process.platform === "win32",
    });
    child.on("error", (err) => {
      console.warn(`Failed to keep ${bin} --wait attached: ${err.message}`);
    });
    console.log(`Opened new ${bin} window: ${path}`);
    console.log(
      "Close that window, or Stop debugging / Ctrl+C, to tear down the sandbox.",
    );
    return { bin, child };
  }
  console.warn(
    `cursor/code not on PATH — open manually in a new window:\n  ${path}`,
  );
  return null;
}

async function confirmTeardown() {
  if (!input.isTTY) {
    // Stop / non-interactive: sandbox is disposable; tear down.
    return true;
  }
  const rl = createInterface({ input, output });
  try {
    const answer = (
      await rl.question(`Tear down sandbox at ${sandboxRoot}? [Y/n] `)
    )
      .trim()
      .toLowerCase();
    return answer === "" || answer === "y" || answer === "yes";
  } finally {
    rl.close();
  }
}

async function teardown({
  force = false,
  /** When false, the editor wait already ended (window closed). */
  windowMayRemain = true,
} = {}) {
  if (!existsSync(sandboxRoot)) {
    console.log(`Nothing to remove: ${sandboxRoot}`);
    return true;
  }
  if (!force && !(await confirmTeardown())) {
    console.log(
      "Leaving sandbox in place. Tear down later with: npm run sandbox:teardown",
    );
    return false;
  }
  runNpm(["run", "install:cursor", "--", "--sandbox", "--teardown"]);
  if (windowMayRemain) {
    console.log(
      "Close any leftover editor window that still pointed at the sandbox folder (Stop/Ctrl+C does not close it).",
    );
  }
  return true;
}

function stopEditorWait(child) {
  if (child?.pid) {
    child.removeAllListeners("exit");
  }
  if (process.platform === "win32") {
    try {
      child?.kill("SIGTERM");
    } catch {
      // already gone
    }
    return;
  }
  // cursor --wait forks past the direct child; match only this sandbox's wait tree
  // (not the main Cursor instance). `--` so patterns starting with - are not flags.
  spawnSync("pkill", ["-f", "--", `--wait ${sandboxRoot}`], { stdio: "ignore" });
  try {
    if (child?.pid) {
      process.kill(-child.pid, "SIGTERM");
    }
  } catch {
    try {
      child?.kill("SIGTERM");
    } catch {
      // already gone
    }
  }
}

/**
 * Stay alive until the editor --wait child exits (window closed) or a signal.
 * Falls back to a heartbeat if no editor CLI was available.
 */
function keepAlive(editor) {
  return new Promise((resolvePromise) => {
    let stopping = false;
    /** When true, wait-child exit is a side effect of our signal handling — ignore it. */
    let ignoreWaitExit = false;
    const heartbeat = editor?.child
      ? null
      : setInterval(() => {}, 60_000);

    const done = () => {
      if (heartbeat) clearInterval(heartbeat);
      resolvePromise();
    };

    const finish = (reason, opts) => {
      if (stopping) return;
      stopping = true;
      ignoreWaitExit = true;
      console.log(`\n${reason}`);
      stopEditorWait(editor?.child);
      void teardown(opts).finally(done);
    };

    if (editor?.child) {
      editor.child.on("exit", (code, signal) => {
        if (ignoreWaitExit || stopping) return;
        // Window closed (or wait ended on its own) — tear down now.
        finish(
          `Editor wait exited (code=${code ?? "null"}, signal=${signal ?? "null"}).`,
          { force: true, windowMayRemain: false },
        );
      });
    }

    const onSignal = (sig) => {
      // SIGTERM: debug Stop — no prompt (session is ending). postDebugTask
      // --force is belt-and-suspenders if this handler does not finish.
      // SIGINT: confirm (default Y) so Ctrl+C can keep a live sandbox.
      const force = sig === "SIGTERM" || sig === "SIGHUP";
      if (force) {
        finish(`Received ${sig}.`, { force: true, windowMayRemain: true });
        return;
      }
      if (stopping) return;
      ignoreWaitExit = true;
      console.log(`\nReceived ${sig}.`);
      void (async () => {
        const ok = await teardown({ force: false, windowMayRemain: true });
        if (ok === false) {
          ignoreWaitExit = false;
          console.log(
            "Still waiting for the sandbox editor window to close (or Stop / Ctrl+C again).",
          );
          return;
        }
        stopping = true;
        stopEditorWait(editor?.child);
        done();
      })();
    };

    process.on("SIGINT", () => onSignal("SIGINT"));
    process.on("SIGTERM", () => onSignal("SIGTERM"));
    process.on("SIGHUP", () => onSignal("SIGHUP"));

    console.log(`Sandbox path: ${sandboxRoot}`);
    if (!editor?.child) {
      console.log(
        "Stop debugging or Ctrl+C to tear down (no editor --wait attached).",
      );
    }
  });
}

async function main() {
  const teardownOnly = process.argv.includes("--teardown");
  const force = process.argv.includes("--force");
  if (teardownOnly) {
    await teardown({ force, windowMayRemain: true });
    return;
  }

  runNpm(["run", "build"]);
  runNpm(["run", "install:cursor", "--", "--sandbox"]);
  const editor = openSandboxWindow(sandboxRoot);
  await keepAlive(editor);
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
