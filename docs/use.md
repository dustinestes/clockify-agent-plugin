<br><br>
<img align="right" src="../assets/logo.svg" height="40" alt="Clockify Agent Plugin">
<h1>Use</h1>
<br clear="both">

Install and use the unofficial Clockify Agent Plugin.

<br>

## Contents

- [Contents](#contents)
- [Credentials](#credentials)
- [Pre-enable Clockify tools](#pre-enable-clockify-tools)
- [Other MCP hosts](#other-mcp-hosts)
  - [Claude Code / Desktop](#claude-code--desktop)
  - [Generic stdio host](#generic-stdio-host)
- [Remove Clockify from a repo](#remove-clockify-from-a-repo)

---

<br>

## Credentials

**`CLOCKIFY_API_KEY` (required)** — Clockify → Preferences → Advanced → Manage API Keys ([Clockify API](https://docs.clockify.me)). Set it as a Cursor plugin / MCP env variable when you install. Do not put it in `.clockify/config.yml`. Do not add a Clockify `.env` to the repo you are tracking time in.

**Workspace (optional)** — pin `workspace_id` in `.clockify/config.yml` per repo (Clockify URL `/workspaces/{id}/`, or `clockify_list_workspaces` during `/clockify-init`). File on disk and how the server finds it (including `config_root` / Cursor layouts): [config.md](./config.md). Fields: [config.yml](./schema/config.yml.md).

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

The server name must match the MCP config key: **`clockify-agent-plugin`** (install script, Directory / npx, and the maintainer sandbox).

**Sample — allow all Clockify Agent Plugin MCP tools:**

```jsonc
{
  // Overrides the in-app MCP allowlist when this key is present.
  // User + project files concatenate; see Cursor permissions docs.
  "mcpAllowlist": [
    "clockify-agent-plugin:*"
  ]
}
```

Equivalent patterns if you prefer listing tools explicitly (same effect as `clockify-agent-plugin:*` today): see [mcp.md](./mcp.md#tools).

When `permissions.json` defines `mcpAllowlist`, that key **replaces** the in-app MCP allowlist (the Settings editor becomes read-only for MCP). Per-user and per-repo files concatenate. Team admin policy, if any, overrides both. Do not use `*:*`.

Cursor references: [permissions.json](https://cursor.com/docs/reference/permissions), [Run Modes](https://cursor.com/docs/agent/security/run-modes).

---

<br>

## Other MCP hosts

Host permission systems differ; see that host's docs. For Cursor, use [Pre-enable Clockify tools](#pre-enable-clockify-tools) above.

### Claude Code / Desktop

```json
{
  "command": "npx",
  "args": ["-y", "@dustinestes/clockify-agent-plugin"],
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

---

<br>

## Remove Clockify from a repo

The Directory / npx **plugin stays installed**. These skills only change the current repo.

| Want | Skill | What it does |
|------|-------|----------------|
| Back to **manual** entry | `/clockify-unautomate` | Removes the Clockify Cursor rule and Clockify-owned hooks. Keeps `.clockify/` so start-timer, enter-time, and summarize still work. |
| **All** Clockify files gone from this repo | `/clockify-uninit` | Unautomate, then deletes `.clockify/` and the managed gitignore stanza (and `.gitignore` itself if that left the file empty). Does not uninstall the plugin or clear `CLOCKIFY_API_KEY` unless you ask. |

Uninstalling the plugin itself is Cursor → remove Clockify Agent Plugin (or drop the npx MCP server). That is separate from uninit.

---

<br>

---

<strong>Clockify Agent Plugin</strong>
<div align="right">

[MIT License](../LICENSE)

</div>
<br clear="both">
