#!/usr/bin/env node
/**
 * Toggle this machine between plugin developer and Directory/npx-style consumer.
 *
 *   node scripts/dev-mode.mjs status
 *   node scripts/dev-mode.mjs link      # enable local plugin + project MCP (clockify-agent-plugin-dev)
 *   node scripts/dev-mode.mjs unlink    # remove local plugin link + strip local-dist MCP globals
 *   node scripts/dev-mode.mjs sandbox   # create disposable repo for skill/MCP smoke tests
 *   node scripts/dev-mode.mjs sandbox-teardown  # remove that sandbox directory
 */
import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readlinkSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pluginId = "clockify-agent-plugin-dev";
const localPlugins = join(homedir(), ".cursor", "plugins", "local");
const pluginLink = join(localPlugins, pluginId);
const legacyPluginIds = ["clockify", "clockify-dev"];
const legacyPluginLinks = legacyPluginIds.map((id) => join(localPlugins, id));
const localServerIds = new Set([pluginId, "clockify-dev"]);
const userMcpPath = join(homedir(), ".cursor", "mcp.json");
const projectMcpPath = join(root, ".cursor", "mcp.json");
const mcpDevTemplate = join(root, "mcp.dev.json");
const mcpPublishTemplate = join(root, "mcp.publish.json");
const repoMcpPath = join(root, "mcp.json");

const cmd = process.argv[2] ?? "status";

function readJson(path, fallback = null) {
  if (!existsSync(path)) return fallback;
  return JSON.parse(readFileSync(path, "utf8"));
}

function writeJson(path, data) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`);
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

function linkTarget(path) {
  if (!existsSync(path)) return null;
  try {
    if (lstatSync(path).isSymbolicLink()) return readlinkSync(path);
  } catch {
    return "(exists, not a symlink)";
  }
  return "(exists, not a symlink)";
}

function isLocalDistEntry(entry) {
  if (!entry || typeof entry !== "object") return false;
  const args = Array.isArray(entry.args) ? entry.args.join(" ") : "";
  const command = String(entry.command ?? "");
  const blob = `${command} ${args} ${JSON.stringify(entry.env ?? {})}`;
  return (
    (blob.includes("clockify-agent-plugin") ||
      blob.includes("clockify-mcp-server")) &&
    (blob.includes("/dist/index.js") || blob.includes("dist/index.js"))
  );
}

function stripLocalDistServers(mcp) {
  if (!mcp?.mcpServers) return { mcp, removed: [] };
  const removed = [];
  const next = { ...mcp, mcpServers: { ...mcp.mcpServers } };
  for (const [name, entry] of Object.entries(next.mcpServers)) {
    if (localServerIds.has(name) || isLocalDistEntry(entry)) {
      removed.push(name);
      delete next.mcpServers[name];
    }
  }
  return { mcp: next, removed };
}

function buildProjectDevMcp() {
  const node = whichNode();
  return {
    mcpServers: {
      [pluginId]: {
        type: "stdio",
        command: node,
        args: ["${workspaceFolder}/dist/index.js"],
        envFile: "${workspaceFolder}/.env",
        env: {
          CLOCKIFY_CONFIG_ROOT: "${workspaceFolder}",
        },
      },
    },
  };
}

function ensurePublishShapedRepoMcp() {
  const publish = readJson(mcpPublishTemplate);
  writeJson(repoMcpPath, publish);
}

function ensureDevShapedRepoMcp() {
  const node = whichNode();
  const dev = {
    mcpServers: {
      "clockify-agent-plugin": {
        command: node,
        args: ["dist/index.js"],
        env: {
          CLOCKIFY_API_KEY: "${CLOCKIFY_API_KEY}",
        },
      },
    },
  };
  writeJson(repoMcpPath, dev);
}

function status() {
  console.log("Clockify Agent Plugin — machine mode\n");
  console.log(`repo: ${root}`);
  console.log(`plugin link (${pluginId}): ${linkTarget(pluginLink) ?? "(none)"}`);
  for (const path of legacyPluginLinks) {
    console.log(
      `legacy link (${basename(path)}): ${linkTarget(path) ?? "(none)"}`,
    );
  }

  const userMcp = readJson(userMcpPath, { mcpServers: {} });
  const names = Object.keys(userMcp.mcpServers ?? {});
  console.log(`~/.cursor/mcp.json servers: ${names.join(", ") || "(none)"}`);
  for (const [name, entry] of Object.entries(userMcp.mcpServers ?? {})) {
    const local = isLocalDistEntry(entry);
    console.log(
      `  - ${name}: ${local ? "LOCAL DIST (dev)" : "not local-dist"}`,
    );
  }

  const projectMcp = readJson(projectMcpPath, { mcpServers: {} });
  console.log(
    `project .cursor/mcp.json: ${Object.keys(projectMcp.mcpServers ?? {}).join(", ") || "(none)"}`,
  );

  const linked = [pluginLink, ...legacyPluginLinks].some(
    (path) => linkTarget(path) === root,
  );
  const hasDevProject = Object.keys(projectMcp.mcpServers ?? {}).some((name) =>
    localServerIds.has(name),
  );
  const hasGlobalLocal = Object.entries(userMcp.mcpServers ?? {}).some(
    ([name, entry]) => localServerIds.has(name) || isLocalDistEntry(entry),
  );

  console.log("");
  if (linked || hasDevProject || hasGlobalLocal) {
    console.log("Mode guess: DEVELOPER (local plugin and/or local-dist MCP present)");
    console.log("Consumer-like test: npm run dev:unlink && reload Cursor");
  } else {
    console.log("Mode guess: CONSUMER-like (no local plugin link / local-dist MCP)");
    console.log("Develop again: npm run dev:link && reload Cursor");
  }
  console.log("\nSee docs/develop.md");
}

function link() {
  mkdirSync(localPlugins, { recursive: true });

  for (const path of legacyPluginLinks) {
    if (existsSync(path)) {
      console.log(`Removing legacy link ${path}`);
      rmSync(path, { force: true });
    }
  }

  if (existsSync(pluginLink)) {
    rmSync(pluginLink, { force: true });
  }
  symlinkSync(root, pluginLink);
  console.log(`Linked plugin: ${pluginLink} -> ${root}`);

  ensureDevShapedRepoMcp();
  console.log("Wrote repo mcp.json for local plugin (node dist/index.js)");

  writeJson(projectMcpPath, buildProjectDevMcp());
  console.log(
    `Wrote project .cursor/mcp.json as ${pluginId} (this workspace only)`,
  );

  // Keep user MCP free of local-dist so other workspaces don't silently use the checkout
  const userMcp = readJson(userMcpPath, { mcpServers: {} });
  const { mcp: cleaned, removed } = stripLocalDistServers(userMcp);
  if (removed.length) {
    writeJson(userMcpPath, cleaned);
    console.log(
      `Removed from ~/.cursor/mcp.json (avoid false consumer positives): ${removed.join(", ")}`,
    );
  } else {
    console.log("~/.cursor/mcp.json already free of local-dist clockify entries");
  }

  console.log(`
Next:
  1. npm run build
  2. Reload Cursor
  3. Customize → Plugins: enable "${pluginId}" (skills via /)
  4. Customize → MCP: "${pluginId}" / project "${pluginId}" (tools from this checkout)

Do not treat this as a consumer install. Use npm run dev:unlink, then Directory or npx.
`);
}

function unlinkMode() {
  for (const path of [pluginLink, ...legacyPluginLinks]) {
    if (existsSync(path)) {
      rmSync(path, { force: true });
      console.log(`Removed ${path}`);
    }
  }

  ensurePublishShapedRepoMcp();
  console.log("Restored repo mcp.json to publish shape (npx)");

  // Project file: empty mcp servers so this workspace doesn't force local dist
  writeJson(projectMcpPath, { mcpServers: {} });
  console.log("Cleared project .cursor/mcp.json");

  const userMcp = readJson(userMcpPath, { mcpServers: {} });
  const { mcp: cleaned, removed } = stripLocalDistServers(userMcp);
  if (removed.length) {
    writeJson(userMcpPath, cleaned);
    console.log(`Removed from ~/.cursor/mcp.json: ${removed.join(", ")}`);
  } else {
    console.log("No local-dist clockify entries in ~/.cursor/mcp.json");
  }

  console.log(`
Consumer-like mode:
  - No ${pluginId} / clockify-agent-plugin local plugin symlink
  - No local-dist MCP in user or this project config
  - Reload Cursor
  - Install from cursor.directory (or add npx mcp.json) to test as a subscriber

Re-enter development: npm run dev:link
`);
}

function sandbox() {
  const sandboxRoot = join(homedir(), "workspaces", "clockify-agent-plugin-sandbox");
  mkdirSync(sandboxRoot, { recursive: true });
  mkdirSync(join(sandboxRoot, ".cursor", "skills"), { recursive: true });

  if (!existsSync(join(sandboxRoot, ".git"))) {
    execFileSync("git", ["init"], { cwd: sandboxRoot, stdio: "ignore" });
  }

  const skills = [
    "clockify-init",
    "clockify-uninit",
    "clockify-automate",
    "clockify-unautomate",
    "clockify-start-timer",
    "clockify-stop-timer",
    "clockify-status",
    "clockify-enter-time",
    "clockify-summarize",
  ];
  for (const name of skills) {
    const dest = join(sandboxRoot, ".cursor", "skills", name);
    rmSync(dest, { recursive: true, force: true });
    symlinkSync(join(root, "skills", name), dest);
  }

  const example = join(root, ".clockify", "config.yml.example");
  if (existsSync(example)) {
    mkdirSync(join(sandboxRoot, ".clockify"), { recursive: true });
    cpSync(example, join(sandboxRoot, ".clockify", "config.yml"));
  }

  const node = whichNode();
  writeJson(join(sandboxRoot, ".cursor", "mcp.json"), {
    mcpServers: {
      [pluginId]: {
        type: "stdio",
        command: node,
        args: [join(root, "dist", "index.js")],
        envFile: join(root, ".env"),
        env: {
          CLOCKIFY_CONFIG_ROOT: sandboxRoot,
        },
      },
    },
  });

  writeFileSync(
    join(sandboxRoot, "README.md"),
    `# clockify-agent-plugin-sandbox

Disposable workspace for testing Clockify Agent Plugin skills/tools without mutating the main repo.

- Skills: symlinked from \`${root}/skills\` (should appear under \`/\` immediately)
- MCP: \`${pluginId}\` → that checkout's \`dist/index.js\` + its \`.env\`
- Config root: this sandbox (safe to write \`.clockify/config.yml\` / rules here)

## Enable MCP (required once)

Project MCP servers often appear in **Customize → MCP** as **disabled** until you turn them on (Cursor treats project-level MCP as opt-in).

1. Open **Customize → MCP**
2. Find **${pluginId}** (may be grouped under this project / sandbox name)
3. Toggle it **enabled** (green)
4. If it stays red, open **Output → MCP Logs**

Then try a tool (e.g. ask for today's Clockify summary) or \`/clockify-start-timer\`.
`,
  );

  console.log(`Sandbox ready: ${sandboxRoot}`);
  console.log("Open that folder in Cursor (separate window).");
  console.log(
    `Skills should work via /. Project MCP often starts DISABLED — enable ${pluginId} under Customize → MCP.`,
  );
}

function sandboxTeardown() {
  const sandboxRoot = join(homedir(), "workspaces", "clockify-agent-plugin-sandbox");
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

switch (cmd) {
  case "status":
    status();
    break;
  case "link":
    link();
    break;
  case "unlink":
    unlinkMode();
    break;
  case "sandbox":
    sandbox();
    break;
  case "sandbox-teardown":
    sandboxTeardown();
    break;
  default:
    console.error(`Unknown command: ${cmd}`);
    console.error(
      "Usage: node scripts/dev-mode.mjs <status|link|unlink|sandbox|sandbox-teardown>",
    );
    process.exit(1);
}
