#!/usr/bin/env node
/**
 * Install Clockify Agent Plugin into Cursor (user-global), or create a
 * maintainer sandbox that points at this checkout's dist/:
 *   - Default: symlink skills → ~/.cursor/skills/; merge MCP → ~/.cursor/mcp.json
 *   - --sandbox: disposable temp repo with project MCP → dist/index.js
 *
 *   npx -y -p @dustinestes/clockify-agent-plugin clockify-cursor-install
 *   npx -y -p @dustinestes/clockify-agent-plugin clockify-cursor-install --help
 */
import { execFileSync } from "node:child_process";
import {
  cpSync,
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
import { dirname, join, resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const serverId = "clockify-agent-plugin";
const userSkillsDir = join(homedir(), ".cursor", "skills");
const userMcpPath = join(homedir(), ".cursor", "mcp.json");
const sandboxRoot = join(tmpdir(), "clockify-agent-plugin-sandbox");

const HELP = `clockify-cursor-install — install Clockify Agent Plugin for Cursor

Usage:
  clockify-cursor-install [options]

Options:
  --help              Show this help
  --dry-run           Print planned changes without writing files
  --uninstall         Remove installed skills and MCP entry
  --api-key <key>     Clockify API key (else CLOCKIFY_API_KEY env or prompt)
  --sandbox           Create a temp repo that runs this checkout's dist/
  --teardown          With --sandbox: remove that temp repo

Installs (user-global):
  • Skills  → ~/.cursor/skills/clockify-*
  • MCP     → ~/.cursor/mcp.json (npx @dustinestes/clockify-agent-plugin)

Sandbox (maintainer; does not touch ~/.cursor/mcp.json):
  • Repo    → $TMPDIR/clockify-agent-plugin-sandbox
  • Skills  → sandbox .cursor/skills/ (symlinks into this checkout)
  • MCP     → sandbox .cursor/mcp.json → this checkout's dist/index.js

After install: reload Cursor, enable MCP under Customize → MCP, then
/clockify-init in each repo (workspace ID is chosen per repo there).

Examples:
  npx -y -p @dustinestes/clockify-agent-plugin clockify-cursor-install
  clockify-cursor-install --dry-run
  CLOCKIFY_API_KEY=... clockify-cursor-install --dry-run
  clockify-cursor-install --sandbox
  clockify-cursor-install --sandbox --teardown
`;

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
  return JSON.parse(readFileSync(path, "utf8"));
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
  3. In each repo: /clockify-init (choose workspace per repo)
`);
}

function createSandbox(dryRun) {
  const skillNames = listSkillNames();
  if (skillNames.length === 0) {
    console.error(`No skills found under ${join(root, "skills")}`);
    process.exit(1);
  }

  const distEntry = join(root, "dist", "index.js");
  const envFile = join(root, ".env");
  const example = join(root, ".clockify", "config.yml.example");
  const sandboxConfig = join(sandboxRoot, ".clockify", "config.yml");
  const node = whichNode();

  console.log("Planned sandbox:\n");
  console.log(`  [dir] ${sandboxRoot}`);
  for (const name of skillNames) {
    console.log(`  [link] ${join(sandboxRoot, ".cursor", "skills", name)} -> ${join(root, "skills", name)}`);
  }
  console.log(`  [mcp]  ${join(sandboxRoot, ".cursor", "mcp.json")} → ${distEntry}`);
  if (existsSync(sandboxConfig)) {
    console.log(`  [skip] ${sandboxConfig} (already present)`);
  } else if (existsSync(example)) {
    console.log(`  [copy] ${example} -> ${sandboxConfig}`);
  }
  console.log("");

  if (!existsSync(distEntry)) {
    console.log(`Warning: ${distEntry} is missing. Run npm run build in the plugin checkout first.\n`);
  }

  if (dryRun) {
    console.log("Dry run — no files changed.");
    return;
  }

  mkdirSync(join(sandboxRoot, ".cursor", "skills"), { recursive: true });

  if (!existsSync(join(sandboxRoot, ".git"))) {
    execFileSync("git", ["init"], { cwd: sandboxRoot, stdio: "ignore" });
  }

  for (const name of skillNames) {
    const dest = join(sandboxRoot, ".cursor", "skills", name);
    rmSync(dest, { recursive: true, force: true });
    symlinkSync(join(root, "skills", name), dest);
  }

  if (!existsSync(sandboxConfig) && existsSync(example)) {
    mkdirSync(join(sandboxRoot, ".clockify"), { recursive: true });
    cpSync(example, sandboxConfig);
  }

  writeJson(join(sandboxRoot, ".cursor", "mcp.json"), {
    mcpServers: {
      [serverId]: {
        type: "stdio",
        command: node,
        args: [distEntry],
        envFile,
        env: {
          CLOCKIFY_CONFIG_ROOT: sandboxRoot,
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
- MCP: \`${serverId}\` → \`dist/index.js\` + checkout \`.env\`
- Config root: this sandbox (safe to write \`.clockify/config.yml\` / rules here)

This is not a consumer install. Global Cursor MCP stays npx / \`clockify-cursor-install\`.

## Enable MCP (required once)

Project MCP servers often appear in **Customize → MCP** as **disabled** until you turn them on.

1. Open **Customize → MCP**
2. Find **${serverId}** (may be grouped under this sandbox folder)
3. Toggle it **enabled** (green)
4. If it stays red, open **Output → MCP Logs**

Rebuild the plugin checkout after \`src/\` changes (\`npm run build\`), then reload this window.
`,
  );

  console.log(`Sandbox ready: ${sandboxRoot}`);
  console.log("Open that folder in Cursor (separate window).");
  console.log(
    `Skills should work via /. Project MCP often starts DISABLED — enable ${serverId} under Customize → MCP.`,
  );
}

function teardownSandbox(dryRun) {
  console.log("Planned sandbox teardown:\n");
  if (existsSync(sandboxRoot)) {
    console.log(`  [remove] ${sandboxRoot}`);
  } else {
    console.log(`  [skip] ${sandboxRoot} (not present)`);
  }
  console.log("");

  if (dryRun) {
    console.log("Dry run — no files changed.");
    return;
  }

  if (!existsSync(sandboxRoot)) {
    console.log(`Nothing to remove: ${sandboxRoot}`);
    return;
  }
  rmSync(sandboxRoot, { recursive: true, force: true });
  console.log(`Removed sandbox: ${sandboxRoot}`);
  console.log(
    "Close any Cursor window that had that folder open, or reload so project MCP/skills disappear.",
  );
}

async function main() {
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
    failUsage("--sandbox does not take --api-key (uses the checkout .env via envFile)");
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
