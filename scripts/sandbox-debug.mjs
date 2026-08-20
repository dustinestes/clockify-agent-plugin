#!/usr/bin/env node
/**
 * Maintainer DX helper for Run and Debug → Sandbox.
 * Wraps existing install:cursor --sandbox flags; does not change that CLI.
 *
 *   npm run sandbox:debug              # build, create, keep-alive until Stop/Ctrl+C
 *   npm run sandbox:teardown           # confirm, then --sandbox --teardown
 *
 * Opens the sandbox in your normal Cursor/VS Code via --new-window. Teardown
 * does not close that window: the CLI has no safe way to close one shared-app
 * window, and an isolated --user-data-dir instance loses your profile (login /
 * Agents UI / folder never opens). Expect a leftover window on a deleted path.
 */
import { execFileSync, spawnSync } from "node:child_process";
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

function openSandboxWindow(path) {
  for (const bin of ["cursor", "code"]) {
    try {
      execFileSync(bin, ["--new-window", path], {
        stdio: "ignore",
        shell: process.platform === "win32",
      });
      console.log(`Opened new ${bin} window: ${path}`);
      return;
    } catch {
      // try next
    }
  }
  console.warn(
    `cursor/code not on PATH — open manually in a new window:\n  ${path}`,
  );
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

async function teardown({ force = false } = {}) {
  if (!existsSync(sandboxRoot)) {
    console.log(`Nothing to remove: ${sandboxRoot}`);
    return;
  }
  if (!force && !(await confirmTeardown())) {
    console.log(
      "Leaving sandbox in place. Tear down later with: npm run sandbox:teardown",
    );
    return;
  }
  runNpm(["run", "install:cursor", "--", "--sandbox", "--teardown"]);
  console.log(
    "Close any leftover editor window that still pointed at the sandbox folder (teardown does not close it).",
  );
}

function keepAliveUntilSignal() {
  return new Promise((resolvePromise) => {
    let stopping = false;
    // Keep the event loop alive until a signal arrives.
    const heartbeat = setInterval(() => {}, 60_000);
    const onSignal = (sig) => {
      if (stopping) return;
      stopping = true;
      console.log(`\nReceived ${sig}.`);
      // SIGTERM is typical for the debug Stop button — tear down without a
      // prompt so shutdown does not hang waiting on stdin.
      // SIGINT (Ctrl+C): confirm (default Y). postDebugTask covers leftovers.
      const force = sig === "SIGTERM" || sig === "SIGHUP";
      void teardown({ force }).finally(() => {
        clearInterval(heartbeat);
        resolvePromise();
      });
    };
    process.on("SIGINT", () => onSignal("SIGINT"));
    process.on("SIGTERM", () => onSignal("SIGTERM"));
    // SIGHUP is best-effort (terminal tab close is not a launch.json event).
    process.on("SIGHUP", () => onSignal("SIGHUP"));
    console.log(`Sandbox path: ${sandboxRoot}`);
    console.log(
      "Stop debugging or Ctrl+C to tear down (closing the terminal tab is not reliable).",
    );
  });
}

async function main() {
  const teardownOnly = process.argv.includes("--teardown");
  if (teardownOnly) {
    await teardown();
    return;
  }

  runNpm(["run", "build"]);
  runNpm(["run", "install:cursor", "--", "--sandbox"]);
  openSandboxWindow(sandboxRoot);
  await keepAliveUntilSignal();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
