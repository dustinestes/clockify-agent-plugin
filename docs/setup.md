<br><br>
<img align="right" src="../assets/logo.svg" height="40" alt="Clockify MCP (unofficial)">
<h1>Setup</h1>
<br clear="both">

Install and configure the unofficial Clockify MCP for Cursor and other hosts. Directory / npx happy path lives in the [root README](../README.md); this page covers credentials, Cursor MCP allowlists, clones, PATH issues, and alternatives.

<br>

## Contents

- [Contents](#contents)
- [Credentials](#credentials)
- [Pre-enable Clockify tools](#pre-enable-clockify-tools)
- [Develop this repo](#develop-this-repo)
- [Node not found](#node-not-found)
- [envFile vs env](#envfile-vs-env)
- [Other MCP hosts](#other-mcp-hosts)
- [Troubleshooting](#troubleshooting)
- [See also](#see-also)

---

<br>

## Credentials

Same values for every host. Details also summarized in the root README.

**`CLOCKIFY_API_KEY` (required)** — Clockify → Preferences → Advanced → Manage API Keys.

**`CLOCKIFY_WORKSPACE_ID` (optional)** — pin a workspace via `/workspaces/{id}/` in the URL, or `clockify_list_workspaces`.

```bash
cp .env.example .env
# edit .env
```

Per-repo standards (`.clockify/config.yml`): [config.md](./config.md).

<br>

---

<br>

## Pre-enable Clockify tools

Cursor asks before running **MCP tools** (Allow once / Always allow). That is not a skill prompt. Agents can look busy, then sit idle waiting on a Clockify approval the user never saw—especially mid-session timer or init flows.

You can approve tools as they appear, or pre-allow them during setup so unattended runs do not stall.

**Prerequisite — Run Mode.** Allowlists apply only when Run Mode is **Auto-review**, **Allowlist**, or **Run Everything** (**Settings → Agents → Approvals & Execution**). MCP tools are not sandboxed like shell; under Auto-review, a non-allowlisted Clockify call may still go to the classifier or an approval prompt. Do not switch to **Run Everything** just for Clockify.

**Decide:**

| Choice | Meaning |
|--------|---------|
| Scope: **user** | All workspaces on this machine (`~/.cursor/permissions.json`) |
| Scope: **project** | This repo only (`<repo>/.cursor/permissions.json`; can be committed for teammates) |
| Method: **UI** | Settings → Agents → Approvals & Execution (MCP allowlist), or **Always allow** on first prompt |
| Method: **file** | Edit `permissions.json` as below |

User-wide if you use Clockify from many repos on this machine. Per-repo if teammates should inherit the same allowlist, or you only want it in one workspace.

The server name must match the `mcp.json` key: **`clockify`** for Marketplace / published / npx installs; **`clockify-dev`** when using local `dev:link` ([develop.md](./develop.md)).

**Sample — allow all Clockify MCP tools** (normal installs):

```jsonc
{
  // Overrides the in-app MCP allowlist when this key is present.
  // User + project files concatenate; see Cursor permissions docs.
  "mcpAllowlist": [
    "clockify:*"
  ]
}
```

For local plugin / `dev:link` installs that register as `clockify-dev`:

```jsonc
{
  "mcpAllowlist": [
    "clockify-dev:*"
  ]
}
```

Equivalent patterns if you prefer listing tools explicitly (same effect as `clockify:*` today):

`clockify_get_config`, `clockify_get_user`, `clockify_list_workspaces`, `clockify_list_projects`, `clockify_ensure_project`, `clockify_list_tags`, `clockify_list_tasks`, `clockify_ensure_task`, `clockify_get_running_timer`, `clockify_start_timer`, `clockify_stop_timer`, `clockify_create_time_entry`, `clockify_list_time_entries`, `clockify_today_summary`.

When `permissions.json` defines `mcpAllowlist`, that key **replaces** the in-app MCP allowlist (the Settings editor becomes read-only for MCP). Per-user and per-repo files concatenate. Team admin policy, if any, overrides both. Do not use `*:*`.

Cursor references: [permissions.json](https://cursor.com/docs/reference/permissions), [Run Modes](https://cursor.com/docs/agent/security/run-modes).

<br>

---

<br>

## Develop this repo

Use explicit developer vs consumer-like modes so local paths do not fake a Directory / npx install — see [develop.md](./develop.md).

```bash
cp .env.example .env
npm install
npm run build
npm run dev:link
# reload Cursor — enable plugin clockify-dev; use MCP clockify-dev
npm run smoke:handshake
npm run smoke:live     # optional
```

```bash
npm run sandbox           # ~/workspaces/clockify-mcp-sandbox
npm run sandbox:teardown
```

`dev:link` writes project `.cursor/mcp.json` as **`clockify-dev`** (this workspace only). Do not put local `dist/index.js` in `~/.cursor/mcp.json` while validating consumer installs. Allowlist that server as `clockify-dev:*` — [Pre-enable Clockify tools](#pre-enable-clockify-tools).

<br>

---

<br>

## Node not found

Cursor launched from a desktop entry often has a minimal PATH, so `"command": "node"` or `"npx"` can fail.

```bash
command -v node   # use the absolute path in mcp.json if needed
```

After changing config, reload Cursor. If MCP is red, open **Output → MCP Logs**.

Quick stdio check:

```bash
set -a && source .env && set +a
node dist/index.js
# idle on stdio; Ctrl+C to stop
```

<br>

---

<br>

## envFile vs env

| Approach | When to use |
|----------|-------------|
| `envFile` → `.env` | Local clone; keeps secrets out of json |
| `env` block in `mcp.json` | Published/`npx` install; hosts without `envFile` |

A repo `.env` is not loaded automatically by the server. Without `envFile` or `env`, tools fail with “CLOCKIFY_API_KEY is required”.

<br>

---

<br>

## Other MCP hosts

Host permission systems differ; see that host's docs. For Cursor, use [Pre-enable Clockify tools](#pre-enable-clockify-tools) above.

### Claude Code / Desktop

```json
{
  "command": "npx",
  "args": ["-y", "@dustinestes/clockify-mcp-server"],
  "env": {
    "CLOCKIFY_API_KEY": "your_key_here"
  }
}
```

```bash
mkdir -p ~/.claude/skills
cp -R skills/clockify-* ~/.claude/skills/
```

### Generic stdio host

Same as Claude once published, or absolute `node` + `dist/index.js` while developing.

<br>

---

<br>

## Troubleshooting

| Symptom | Likely cause |
|---------|----------------|
| Server not listed under Customize → MCP | Unloaded path; invalid json; Node not on PATH |
| `CLOCKIFY_API_KEY is required` | Missing `env` / `envFile` |
| Workspace ID not found | Typo in `CLOCKIFY_WORKSPACE_ID` |
| `npx -y @dustinestes/clockify-mcp-server` fails | Not published yet, or PATH issue |
| Agent sits idle after the first Clockify tool call | Waiting on MCP tool approval; [pre-enable tools](#pre-enable-clockify-tools) |

<br>

---

<br>

## See also

- [develop.md](./develop.md) - local plugin modes
- [publish.md](./publish.md) - npm and cursor.directory
- [Docs index](./README.md)
- [Cursor permissions.json](https://cursor.com/docs/reference/permissions)
- [Clockify API](https://docs.clockify.me)

<br>

---

<br>

<strong>Clockify MCP Server</strong>
<div align="right">

[MIT License](../LICENSE)

</div>
<br clear="both">
