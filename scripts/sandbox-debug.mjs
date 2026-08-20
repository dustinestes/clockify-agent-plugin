#!/usr/bin/env node
/**
 * Maintainer DX helper for Run and Debug → Sandbox.
 * Wraps existing install:cursor --sandbox flags; does not change that CLI.
 *
 *   npm run sandbox:debug              # build, create, keep-alive until Stop/Ctrl+C
 *   npm run sandbox:teardown           # confirm, then --sandbox --teardown
 *   npm run sandbox:teardown -- --force  # no prompt (postDebugTask / Stop cleanup)
 *
 * Opens the sandbox with cursor/code --new-window (no --wait). Reload Window
 * in that editor must not tear down the temp folder.
 *
 * Stop (SIGTERM): exit 0 immediately — launch.json postDebugTask runs
 * --force teardown. Do not tear down in the signal handler or the debugger
 * force-kills the process mid-npm and the terminal shows "Killed".
 * Ctrl+C (SIGINT): confirm, then tear down in-process.
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

/** Fire-and-forget: open a new window; do not attach --wait (Reload ends wait). */
function openSandboxWindow(path) {
  for (const bin of ["cursor", "code"]) {
    const probe = spawnSync(bin, ["--version"], {
      stdio: "ignore",
      shell: process.platform === "win32",
    });
    if (probe.error || (probe.status !== 0 && probe.status !== null)) {
      continue;
    }
    const child = spawn(bin, ["--new-window", path], {
      stdio: "ignore",
      detached: true,
      shell: process.platform === "win32",
    });
    child.unref();
    child.on("error", (err) => {
      console.warn(`Failed to open ${bin}: ${err.message}`);
    });
    console.log(`Opened new ${bin} window: ${path}`);
    console.log(
      "Stop debugging or Ctrl+C to tear down the sandbox (closing or reloading the editor window does not).",
    );
    return true;
  }
  console.warn(
    `cursor/code not on PATH — open manually in a new window:\n  ${path}`,
  );
  return false;
}

async function confirmTeardown() {
  if (!input.isTTY) {
    // Non-interactive: sandbox is disposable; tear down.
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

async function teardown({ force = false } = {}) {
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
  console.log(
    "Close any leftover editor window that still pointed at the sandbox folder (Stop/Ctrl+C does not close it).",
  );
  return true;
}

/**
 * Stay alive until Stop (SIGTERM) or Ctrl+C (SIGINT). Editor window close /
 * Reload Window intentionally do not end this process.
 */
function keepAlive() {
  return new Promise((resolvePromise) => {
    let stopping = false;
    const heartbeat = setInterval(() => {}, 60_000);

    const done = () => {
      clearInterval(heartbeat);
      resolvePromise();
    };

    const onStopSignal = (sig) => {
      // Exit cleanly so the debug terminal is not force-killed mid-teardown.
      // launch.json postDebugTask runs sandbox:teardown --force next.
      if (stopping) return;
      stopping = true;
      clearInterval(heartbeat);
      console.log(
        `\nReceived ${sig}. Exiting; postDebugTask (or npm run sandbox:teardown) removes the sandbox.`,
      );
      process.exit(0);
    };

    const onInterrupt = () => {
      if (stopping) return;
      console.log("\nReceived SIGINT.");
      void (async () => {
        const ok = await teardown({ force: false });
        if (ok === false) {
          console.log("Still waiting for Stop or Ctrl+C again.");
          return;
        }
        stopping = true;
        done();
      })();
    };

    process.on("SIGINT", onInterrupt);
    process.on("SIGTERM", () => onStopSignal("SIGTERM"));
    process.on("SIGHUP", () => onStopSignal("SIGHUP"));

    console.log(`Sandbox path: ${sandboxRoot}`);
    console.log("Stop debugging or Ctrl+C to tear down.");
  });
}

async function main() {
  const teardownOnly = process.argv.includes("--teardown");
  const force = process.argv.includes("--force");
  if (teardownOnly) {
    await teardown({ force });
    return;
  }

  runNpm(["run", "build"]);
  runNpm(["run", "install:cursor", "--", "--sandbox"]);
  openSandboxWindow(sandboxRoot);
  await keepAlive();
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
