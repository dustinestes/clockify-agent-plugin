#!/usr/bin/env node
/**
 * Install Clockify Agent Plugin into Cursor (user-global), or create a
 * maintainer sandbox that points at this checkout's dist/:
 *   - Default: symlink skills → ~/.cursor/skills/; merge MCP → ~/.cursor/mcp.json
 *   - --sandbox: disposable temp repo with project MCP → dist/index.js
 *
 *   npx -y -p @dustinestes/clockify-agent-plugin clockify-install-cursor
 *   npx -y -p @dustinestes/clockify-agent-plugin clockify-install-cursor --help
 *
 * Deprecated alias (same script): clockify-cursor-install
 */
import { execFileSync } from "node:child_process";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { homedir, tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const serverId = "clockify-agent-plugin";
const sandboxServerId = "clockify-agent-plugin-sandbox";
const sandboxApiKeyEnv = "CLOCKIFY_API_KEY_SANDBOX";
const userSkillsDir = join(homedir(), ".cursor", "skills");
const userMcpPath = join(homedir(), ".cursor", "mcp.json");
const sandboxRoot = join(tmpdir(), "clockify-agent-plugin-sandbox");
const sandboxMcpEnvFlag = "CLOCKIFY_MCP_SANDBOX";
const binName = "clockify-install-cursor";
const deprecatedBinName = "clockify-cursor-install";

const HELP = `${binName} — install Clockify Agent Plugin for Cursor

Usage:
  ${binName} [options]

Options:
  --help              Show this help
  --dry-run           Print planned changes without writing files
  --uninstall         Remove installed skills and MCP entry
  --api-key <key>     Clockify API key (else CLOCKIFY_API_KEY env or prompt)
  --sandbox           Tear down any existing sandbox, then create a temp repo → dist/
  --teardown          With --sandbox: remove temp repo and kill tagged sandbox MCP

Installs (user-global):
  • Skills  → ~/.cursor/skills/clockify-*
  • MCP     → ~/.cursor/mcp.json (npx @dustinestes/clockify-agent-plugin)

Sandbox (maintainer; does not touch ~/.cursor/mcp.json):
  • Repo    → $TMPDIR/clockify-agent-plugin-sandbox
  • Skills  → sandbox .cursor/skills/ (symlinks into this checkout)
  • MCP     → sandbox .cursor/mcp.json → ${sandboxServerId} → dist/index.js
  • Tag     → ${sandboxMcpEnvFlag}=1 (one sandbox at a time; --sandbox tears down first; not consumer MCP)
  • API key → bake from checkout .env ${sandboxApiKeyEnv} (or empty for hand-fill)

After install: reload Cursor, enable MCP under Customize → MCP, then
/clockify-init in each repo (workspace and shape are chosen per repo there).

Examples:
  npx -y -p @dustinestes/clockify-agent-plugin ${binName}
  ${binName} --dry-run
  CLOCKIFY_API_KEY=... ${binName} --dry-run
  ${binName} --sandbox
  ${binName} --sandbox --teardown
`;

function invokedBinName() {
  return basename(process.argv[1] ?? "").replace(/\.(cmd|exe|ps1)$/i, "");
}

function warnIfDeprecatedBin() {
  if (invokedBinName() !== deprecatedBinName) return;
  console.warn(
    `Warning: ${deprecatedBinName} is deprecated; use ${binName} instead.`,
  );
}

function parseArgs(argv) {
  const opts = {
    help: false,
    dryRun: false,
    uninstall: false,
    sandbox: false,
    teardown: false,
    apiKeyFromFlag: false,
    apiKey: process.env.CLOCKIFY_API_KEY?.trim() || undefined,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") opts.help = true;
    else if (arg === "--dry-run") opts.dryRun = true;
    else if (arg === "--uninstall") opts.uninstall = true;
    else if (arg === "--sandbox") opts.sandbox = true;
    else if (arg === "--teardown") opts.teardown = true;
    else if (arg === "--api-key") {
      opts.apiKey = argv[++i]?.trim();
      opts.apiKeyFromFlag = true;
      if (!opts.apiKey) {
        console.error("--api-key requires a value");
        process.exit(1);
      }
    } else {
      console.error(`Unknown option: ${arg}\nRun with --help for usage.`);
      process.exit(1);
    }
  }
  return opts;
}

function failUsage(message) {
  console.error(message);
  process.exit(1);
}

function readJson(path, fallback = null) {
  if (!existsSync(path)) return fallback;
  const raw = readFileSync(path, "utf8");
  try {
    return JSON.parse(raw);
  } catch (err) {
    const detail = err instanceof SyntaxError ? err.message : String(err);
    console.error(
      `Invalid JSON in ${path}\n  ${detail}\nFix or remove that file and retry.`,
    );
    process.exit(1);
  }
}

function writeJson(path, data) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`);
}

function listSkillNames() {
  const skillsRoot = join(root, "skills");
  if (!existsSync(skillsRoot)) return [];
  return readdirSync(skillsRoot, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .filter((d) => existsSync(join(skillsRoot, d.name, "SKILL.md")))
    .map((d) => d.name)
    .sort();
}

function linkTarget(path) {
  if (!existsSync(path)) return null;
  try {
    if (lstatSync(path).isSymbolicLink()) return readlinkSync(path);
  } catch {
    return "(exists, not a symlink)";
  }
  return "(exists, not a symlink)";
}

function whichNode() {
  try {
    return execFileSync("bash", ["-lc", "command -v node"], {
      encoding: "utf8",
    }).trim();
  } catch {
    return "node";
  }
}

function distEntryPath() {
  return join(root, "dist", "index.js");
}

function sleepMs(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function pidAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function environHasFlag(environUtf8) {
  return environUtf8.split("\0").includes(`${sandboxMcpEnvFlag}=1`);
}

function findSandboxMcpPidsLinux(distEntry) {
  const pids = [];
  let names;
  try {
    names = readdirSync("/proc");
  } catch {
    return pids;
  }
  for (const name of names) {
    if (!/^\d+$/.test(name)) continue;
    const pid = Number(name);
    if (pid === process.pid) continue;
    try {
      const cmdline = readFileSync(join("/proc", name, "cmdline"));
      if (!cmdline.toString("utf8").includes(distEntry)) continue;
      const environ = readFileSync(join("/proc", name, "environ"));
      if (!environHasFlag(environ.toString("utf8"))) continue;
      pids.push(pid);
    } catch {
      // process exited or not readable
    }
  }
  return pids;
}

function findSandboxMcpPidsDarwin(distEntry) {
  const pids = [];
  let out;
  try {
    out = execFileSync("ps", ["eww", "-A", "-o", "pid=,command="], {
      encoding: "utf8",
      maxBuffer: 32 * 1024 * 1024,
    });
  } catch {
    return pids;
  }
  const needle = `${sandboxMcpEnvFlag}=1`;
  for (const line of out.split("\n")) {
    const match = line.trim().match(/^(\d+)\s+(.*)$/);
    if (!match) continue;
    const pid = Number(match[1]);
    if (pid === process.pid) continue;
    const rest = match[2];
    if (!rest.includes(distEntry) || !rest.includes(needle)) continue;
    pids.push(pid);
  }
  return pids;
}

/** Cursor-owned sandbox MCP children tagged CLOCKIFY_MCP_SANDBOX=1 for this checkout. */
function findSandboxMcpPids() {
  const distEntry = distEntryPath();
  if (process.platform === "linux") return findSandboxMcpPidsLinux(distEntry);
  if (process.platform === "darwin") return findSandboxMcpPidsDarwin(distEntry);
  return null;
}

/**
 * Remove leftover sandbox MCP Node. Teardown deletes the temp folder first
 * (so Cursor cannot respawn from mcp.json), then calls this.
 */
function reapSandboxMcp({ dryRun, label, quiet = false }) {
  const pids = findSandboxMcpPids();
  const say = (line) => {
    if (!quiet) console.log(line);
  };
  if (pids === null) {
    say(
      `  [mcp] skip reap on ${process.platform} — kill leftover node ${distEntryPath()} with ${sandboxMcpEnvFlag}=1 manually`,
    );
    return;
  }
  if (pids.length === 0) {
    say(`  [mcp] no leftover sandbox MCP (${label})`);
    return;
  }
  for (const pid of pids) {
    say(
      dryRun
        ? `  [mcp] would SIGTERM pid ${pid} (${label})`
        : `  [mcp] SIGTERM pid ${pid} (${label})`,
    );
    if (!dryRun) {
      try {
        process.kill(pid, "SIGTERM");
      } catch {
        // already gone
      }
    }
  }
  if (dryRun) return;
  const deadline = Date.now() + 2000;
  let still = pids.filter(pidAlive);
  while (still.length > 0 && Date.now() < deadline) {
    sleepMs(100);
    still = still.filter(pidAlive);
  }
  for (const pid of still) {
    say(`  [mcp] SIGKILL pid ${pid} (${label})`);
    try {
      process.kill(pid, "SIGKILL");
    } catch {
      // already gone
    }
  }
}

/** Read a single key from a dotenv file (no expansion). Undefined if missing. */
function readDotEnvValue(filePath, key) {
  if (!existsSync(filePath)) return undefined;
  for (const line of readFileSync(filePath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    if (trimmed.slice(0, eq).trim() !== key) continue;
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    return value;
  }
  return undefined;
}

function buildMcpEntry(apiKey) {
  return {
    command: "npx",
    args: ["-y", "@dustinestes/clockify-agent-plugin"],
    env: {
      CLOCKIFY_API_KEY: apiKey,
    },
  };
}

function planSkillInstalls(skillNames) {
  const actions = [];
  for (const name of skillNames) {
    const src = join(root, "skills", name);
    const dest = join(userSkillsDir, name);
    const existing = linkTarget(dest);
    if (existing === src) {
      actions.push({ type: "skip", name, dest, reason: "already linked" });
    } else if (existing) {
      actions.push({
        type: "replace",
        name,
        dest,
        src,
        warning: `replacing ${existing}`,
      });
    } else {
      actions.push({ type: "link", name, dest, src });
    }
  }
  return actions;
}

function printPlan(actions, mcpAction) {
  console.log("Planned changes:\n");
  for (const a of actions) {
    if (a.type === "skip") {
      console.log(`  [skip] skill ${a.name} (${a.reason})`);
    } else {
      console.log(`  [${a.type}] ${a.dest} -> ${a.src}`);
      if (a.warning) console.log(`         (${a.warning})`);
    }
  }
  if (mcpAction.type === "skip") {
    console.log(`  [skip] MCP ${serverId} (${mcpAction.reason})`);
  } else {
    console.log(`  [${mcpAction.type}] ~/.cursor/mcp.json → ${serverId}`);
    if (mcpAction.warning) console.log(`         (${mcpAction.warning})`);
  }
  console.log("");
}

function applySkillActions(actions, dryRun) {
  if (!dryRun) mkdirSync(userSkillsDir, { recursive: true });
  for (const a of actions) {
    if (a.type === "skip") continue;
    if (dryRun) continue;
    if (existsSync(a.dest)) rmSync(a.dest, { recursive: true, force: true });
    symlinkSync(a.src, a.dest);
  }
}

function planMcpInstall(apiKey) {
  const userMcp = readJson(userMcpPath, { mcpServers: {} });
  const servers = { ...(userMcp.mcpServers ?? {}) };
  const existing = servers[serverId];
  const next = buildMcpEntry(apiKey);
  if (existing && JSON.stringify(existing) === JSON.stringify(next)) {
    return { type: "skip", reason: "unchanged", servers };
  }
  if (existing) {
    return {
      type: "update",
      warning: "overwriting existing entry",
      servers: { ...servers, [serverId]: next },
    };
  }
  return {
    type: "add",
    servers: { ...servers, [serverId]: next },
  };
}

function applyMcp(mcpAction, dryRun) {
  if (mcpAction.type === "skip" || dryRun) return;
  writeJson(userMcpPath, { mcpServers: mcpAction.servers });
}

async function promptApiKey() {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const key = (await rl.question("Clockify API key: ")).trim();
    if (!key) {
      console.error("API key is required (or pass --api-key / CLOCKIFY_API_KEY).");
      process.exit(1);
    }
    return key;
  } finally {
    rl.close();
  }
}

function uninstall(dryRun) {
  const skillNames = listSkillNames();
  const actions = [];
  for (const name of skillNames) {
    const dest = join(userSkillsDir, name);
    const target = linkTarget(dest);
    if (target === join(root, "skills", name)) {
      actions.push({ type: "remove", dest });
    }
  }

  const userMcp = readJson(userMcpPath, { mcpServers: {} });
  const servers = { ...(userMcp.mcpServers ?? {}) };
  const hadMcp = serverId in servers;
  if (hadMcp) delete servers[serverId];

  console.log("Planned uninstall:\n");
  for (const a of actions) console.log(`  [remove] ${a.dest}`);
  if (hadMcp) console.log(`  [remove] ~/.cursor/mcp.json → ${serverId}`);
  else console.log(`  [skip] MCP ${serverId} (not present)`);
  console.log("");

  if (dryRun) {
    console.log("Dry run — no files changed.");
    return;
  }

  for (const a of actions) rmSync(a.dest, { recursive: true, force: true });
  if (hadMcp) {
    if (Object.keys(servers).length === 0) {
      writeJson(userMcpPath, { mcpServers: {} });
    } else {
      writeJson(userMcpPath, { mcpServers: servers });
    }
  }

  console.log("Uninstall complete. Reload Cursor.");
}

async function install(opts) {
  const skillNames = listSkillNames();
  if (skillNames.length === 0) {
    console.error(`No skills found under ${join(root, "skills")}`);
    process.exit(1);
  }

  let apiKey = opts.apiKey;
  if (!apiKey && !opts.dryRun) {
    apiKey = await promptApiKey();
  } else if (!apiKey && opts.dryRun) {
    apiKey = "(your-api-key)";
  }

  const skillActions = planSkillInstalls(skillNames);
  const mcpAction = planMcpInstall(apiKey);

  printPlan(skillActions, mcpAction);

  if (opts.dryRun) {
    console.log("Dry run — no files changed.");
    return;
  }

  applySkillActions(skillActions, false);
  applyMcp(mcpAction, false);

  console.log(`Installed ${skillNames.length} skills and MCP ${serverId}.`);
  console.log(`
Next:
  1. Reload Cursor (Developer: Reload Window)
  2. Customize → MCP: enable "${serverId}"
  3. In each repo: /clockify-init (choose workspace and shape per repo)
`);
}

function createSandbox(dryRun) {
  const skillNames = listSkillNames();
  if (skillNames.length === 0) {
    console.error(`No skills found under ${join(root, "skills")}`);
    process.exit(1);
  }

  const distEntry = distEntryPath();
  const checkoutEnv = join(root, ".env");
  const seededKey =
    readDotEnvValue(checkoutEnv, sandboxApiKeyEnv)?.trim() || "";
  const node = whichNode();

  console.log("Planned sandbox:\n");
  console.log(`  [dir] ${sandboxRoot}`);
  for (const name of skillNames) {
    console.log(`  [link] ${join(sandboxRoot, ".cursor", "skills", name)} -> ${join(root, "skills", name)}`);
  }
  console.log(
    `  [mcp]  ${join(sandboxRoot, ".cursor", "mcp.json")} → ${sandboxServerId} → ${distEntry}`,
  );
  if (seededKey) {
    console.log(
      `  [key]  ${sandboxApiKeyEnv} from checkout .env (baked into mcp env; value not shown)`,
    );
  } else {
    console.log(
      `  [key]  CLOCKIFY_API_KEY left empty — set ${sandboxApiKeyEnv} in checkout .env, or hand-fill sandbox mcp.json env`,
    );
  }
  console.log("");

  if (!existsSync(distEntry)) {
    console.log(`Warning: ${distEntry} is missing. Run npm run build in the plugin checkout first.\n`);
  }

  if (dryRun) {
    console.log("Dry run — no files changed.");
    return;
  }

  teardownSandbox(false, { quiet: true });

  mkdirSync(join(sandboxRoot, ".cursor", "skills"), { recursive: true });

  if (!existsSync(join(sandboxRoot, ".git"))) {
    execFileSync("git", ["init"], { cwd: sandboxRoot, stdio: "ignore" });
  }

  for (const name of skillNames) {
    const dest = join(sandboxRoot, ".cursor", "skills", name);
    rmSync(dest, { recursive: true, force: true });
    symlinkSync(join(root, "skills", name), dest);
  }

  writeJson(join(sandboxRoot, ".cursor", "mcp.json"), {
    mcpServers: {
      [sandboxServerId]: {
        type: "stdio",
        command: node,
        args: [distEntry],
        env: {
          CLOCKIFY_API_KEY: seededKey,
          CLOCKIFY_CONFIG_ROOT: sandboxRoot,
          CLOCKIFY_MCP_LOG: "debug",
          [sandboxMcpEnvFlag]: "1",
        },
      },
    },
  });

  writeFileSync(
    join(sandboxRoot, "README.md"),
    `# clockify-agent-plugin-sandbox

Disposable workspace for playing with Clockify Agent Plugin changes from:

\`${root}\`

- Skills: symlinked from that checkout (should appear under \`/\`)
- MCP: **${sandboxServerId}** → \`dist/index.js\` (distinct from consumer \`${serverId}\`)
- Logs: \`CLOCKIFY_MCP_LOG=debug\` (stderr JSON; Cursor **Output** channel for this server). See plugin checkout \`docs/logging.md\`.
- Tag: \`${sandboxMcpEnvFlag}=1\` so teardown can reap leftover Node without touching user npx MCP
- API key: baked from checkout \`.env\` \`${sandboxApiKeyEnv}\`, or edit \`env.CLOCKIFY_API_KEY\` in \`.cursor/mcp.json\` if empty
- No \`.clockify/config.yml\` until \`/clockify-init\`

This is not a consumer install. Global Cursor MCP stays npx / \`${binName}\`. Only one sandbox at a time: re-running \`--sandbox\` tears down the previous sandbox (folder + tagged Node), then creates.

## Enable MCP (required once)

Project MCP servers often appear in **Customize → MCP** as **disabled** until you turn them on.

1. Open **Customize → MCP**
2. Find **${sandboxServerId}** (may be grouped under this sandbox folder)
3. Toggle it **enabled** (green)
4. Leave user **${serverId}** disabled in this window (both enabled → duplicate Clockify tools)
5. If it stays red or later disables itself, open **Output → MCP Logs** (see plugin checkout \`docs/logging.md\`)

Rebuild the plugin checkout after \`src/\` changes (\`npm run build\`), then reload this window.
`,
  );

  console.log(`Sandbox ready: ${sandboxRoot}`);
  console.log("Open that folder in Cursor (separate window).");
  console.log(
    `Skills should work via /. Enable ${sandboxServerId} under Customize → MCP (leave ${serverId} off in this window).`,
  );
  if (!seededKey) {
    console.log(
      `API key empty — add ${sandboxApiKeyEnv} to ${checkoutEnv} and re-run --sandbox, or edit sandbox .cursor/mcp.json env.CLOCKIFY_API_KEY.`,
    );
  }
}

function teardownSandbox(dryRun, { quiet = false } = {}) {
  if (!quiet) {
    console.log("Planned sandbox teardown:\n");
    if (existsSync(sandboxRoot)) {
      console.log(`  [remove] ${sandboxRoot}`);
    } else {
      console.log(`  [skip] ${sandboxRoot} (not present)`);
    }
    const previewPids = findSandboxMcpPids();
    if (previewPids === null) {
      console.log(
        `  [mcp] skip reap on ${process.platform} — kill leftover node ${distEntryPath()} with ${sandboxMcpEnvFlag}=1 manually`,
      );
    } else if (previewPids.length === 0) {
      console.log("  [mcp] no leftover sandbox MCP");
    } else {
      console.log(`  [mcp] reap pids ${previewPids.join(", ")}`);
    }
    console.log("");
  }

  if (dryRun) {
    if (!quiet) console.log("Dry run — no files changed.");
    return;
  }

  // Remove mcp.json first so Cursor cannot respawn, then SIGTERM tagged Node.
  if (existsSync(sandboxRoot)) {
    rmSync(sandboxRoot, { recursive: true, force: true });
    if (!quiet) console.log(`Removed sandbox: ${sandboxRoot}`);
  } else if (!quiet) {
    console.log(`Nothing to remove: ${sandboxRoot}`);
  }
  reapSandboxMcp({ dryRun: false, label: "after remove", quiet });
  if (!quiet) {
    console.log(
      "Close any Cursor window that had that folder open, or reload so project MCP/skills disappear.",
    );
  }
}

async function main() {
  warnIfDeprecatedBin();
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    console.log(HELP);
    return;
  }
  if (opts.teardown && !opts.sandbox) {
    failUsage("--teardown requires --sandbox");
  }
  if (opts.sandbox && opts.uninstall) {
    failUsage("Use either --sandbox or --uninstall, not both");
  }
  if (opts.sandbox && opts.apiKeyFromFlag) {
    failUsage(
      `--sandbox does not take --api-key (seed checkout .env ${sandboxApiKeyEnv}, or hand-fill sandbox mcp.json)`,
    );
  }
  if (opts.sandbox && opts.teardown) {
    teardownSandbox(opts.dryRun);
    return;
  }
  if (opts.sandbox) {
    createSandbox(opts.dryRun);
    return;
  }
  if (opts.uninstall) {
    uninstall(opts.dryRun);
    return;
  }
  await install(opts);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
