<br><br>
<img align="right" src="../assets/logo.svg" height="40" alt="Clockify Agent Plugin">
<h1>Getting started</h1>
<br clear="both">

Install and use the unofficial Clockify Agent Plugin. The short happy path is in the [root README](../README.md). This page is credentials, the Cursor MCP allowlist, PATH, and other hosts.

Maintainers cloning *this* repo: [develop.md](./develop.md).

<br>

## Contents

- [Contents](#contents)
- [Credentials](#credentials)
- [Pre-enable Clockify tools](#pre-enable-clockify-tools)
- [Node not found](#node-not-found)
- [Other MCP hosts](#other-mcp-hosts)
- [Troubleshooting](#troubleshooting)
- [See also](#see-also)

---

<br>

## Credentials

**`CLOCKIFY_API_KEY` (required)** — Clockify → Preferences → Advanced → Manage API Keys. Set it as a Cursor plugin / MCP env variable when you install. Do not put it in `.clockify/config.yml`. Do not add a Clockify `.env` to the repo you are tracking time in.

**Workspace (optional)** — pin a workspace via `/workspaces/{id}/` in the Clockify URL, or `clockify_list_workspaces`. Until config.yml grows a pin field, you can pass `CLOCKIFY_WORKSPACE_ID` in MCP env. Per-repo standards: [config.md](./config.md).

<br>

---

<br>

## Pre-enable Clockify tools

Cursor asks before running **MCP tools** (Allow once / Always allow). That is not a skill prompt. Agents can look busy, then sit idle waiting on a Clockify approval the user never saw—especially mid-session timer or init flows.

You can approve tools as they appear, or pre-allow them so unattended runs do not stall.

**Prerequisite — Run Mode.** Allowlists apply only when Run Mode is **Auto-review**, **Allowlist**, or **Run Everything** (**Settings → Agents → Approvals & Execution**). MCP tools are not sandboxed like shell; under Auto-review, a non-allowlisted Clockify call may still go to the classifier or an approval prompt. Do not switch to **Run Everything** just for Clockify.

**Decide:**

| Choice | Meaning |
|--------|---------|
| Scope: **user** | All workspaces on this machine (`~/.cursor/permissions.json`) |
| Scope: **project** | This repo only (`<repo>/.cursor/permissions.json`; can be committed for teammates) |
| Method: **UI** | Settings → Agents → Approvals & Execution (MCP allowlist), or **Always allow** on first prompt |
| Method: **file** | Edit `permissions.json` as below |

User-wide if you use Clockify from many repos on this machine. Per-repo if teammates should inherit the same allowlist, or you only want it in one workspace.

The server name must match the MCP config key: **`clockify`** for Directory / npx installs; **`clockify-dev`** when using local `dev:link` ([develop.md](./develop.md)).

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

For local `dev:link` installs that register as `clockify-dev`:

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

## Node not found

Cursor launched from a desktop entry often has a minimal PATH, so `"command": "npx"` can fail.

```bash
command -v node   # use the absolute path in MCP config if needed
```

After changing config, reload Cursor. If MCP is red, open **Output → MCP Logs**.

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

Same `npx` command and `CLOCKIFY_API_KEY` env, or absolute `node` + `dist/index.js` while developing this repo ([develop.md](./develop.md)).

<br>

---

<br>

## Troubleshooting

| Symptom | Likely cause |
|---------|----------------|
| Server not listed under Customize → MCP | Unloaded path; invalid json; Node not on PATH |
| `CLOCKIFY_API_KEY is required` | Missing plugin / MCP `env` |
| Workspace ID not found | Typo in `CLOCKIFY_WORKSPACE_ID` |
| `npx -y @dustinestes/clockify-mcp-server` fails | Node/npx not on PATH, or registry/network |
| Agent sits idle after the first Clockify tool call | Waiting on MCP tool approval; [pre-enable tools](#pre-enable-clockify-tools) |

<br>

---

<br>

## See also

- [develop.md](./develop.md) — local plugin modes
- [publish.md](./publish.md) — npm and cursor.directory
- [Docs index](./README.md)
- [Cursor permissions.json](https://cursor.com/docs/reference/permissions)
- [Clockify API](https://docs.clockify.me)

<br>

---

<br>

<strong>Clockify Agent Plugin</strong>
<div align="right">

[MIT License](../LICENSE)

</div>
<br clear="both">
