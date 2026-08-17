<br><br>
<img align="right" src="../assets/logo.svg" height="40" alt="Clockify MCP (unofficial)">
<h1>Develop</h1>
<br clear="both">

How to develop this MCP on a machine that may also act like a Directory / npx subscriber. Explicit modes avoid false positives (green MCP that is really your checkout; skills missing because only MCP was wired).

<br>

## Contents

- [Contents](#contents)
- [Repo layout](#repo-layout)
- [Modes](#modes)
- [Developer mode](#developer-mode)
- [Consumer-like mode](#consumer-like-mode)
- [Sandbox](#sandbox)
- [Mental model](#mental-model)
- [MCP tools](#mcp-tools)

---

<br>

## Repo layout

Why the tree looks like this (Directory does **not** read this section; it only scans `.mcp.json` and `skills/*/SKILL.md`):

```text
clockify-mcp-server/
├── .cursor-plugin/plugin.json   # local Cursor plugin + variables
├── .mcp.json                    # Directory MCP discovery (npx; never rewritten by dev:link)
├── assets/                      # logo + README lockups
├── docs/
├── skills/                      # Agent Skills (Directory snapshot)
├── src/                         # MCP server
├── mcp.json                     # local plugin MCP entry (dev:link may rewrite)
├── package.json
└── README.md
```

`mcp.publish.json` / `mcp.dev.json` are templates for unlink/link. Do not commit a `dev:link`-shaped `mcp.json`.

---

<br>

## Modes

| Mode | Purpose | How |
|------|---------|-----|
| **Developer** | Iterate this repo (tools + plugin skills) | `npm run dev:link` |
| **Consumer-like** | Behave like a Directory / npx user on this machine | `npm run dev:unlink` |

```bash
npm run dev:status
```

After link or unlink: **reload Cursor**.

---

<br>

## Developer mode

`npm run dev:link`:

1. Symlinks this repo to `~/.cursor/plugins/local/clockify-dev` (not `clockify`, so the published plugin id does not collide)
2. Points repo `mcp.json` at local `node dist/index.js` for the local plugin (does not rewrite `.mcp.json`)
3. Writes **project** `.cursor/mcp.json` with server id **`clockify-dev`**
4. Removes local-dist Clockify entries from `~/.cursor/mcp.json`

```bash
npm run build
# reload Cursor
```

Verify: Plugins → `clockify-dev` (skills via `/`); MCP → `clockify-dev` green. This is not a consumer-install proof. Pre-allow tools as `clockify-dev:*` (not `clockify:*`) — [use.md](./use.md#pre-enable-clockify-tools).

---

<br>

## Consumer-like mode

`npm run dev:unlink`:

1. Removes `clockify-dev` / legacy `clockify` local plugin symlinks
2. Restores repo `mcp.json` to publish/npx shape (`mcp.publish.json`)
3. Clears this project's `.cursor/mcp.json`
4. Strips local-dist Clockify servers from `~/.cursor/mcp.json`

Reload, then install from [cursor.directory](https://cursor.directory) or configure npx as a subscriber would.

---

<br>

## Sandbox

Test skills/init without mutating this repo:

```bash
npm run sandbox           # ~/workspaces/clockify-mcp-sandbox
npm run sandbox:teardown
```

- Skills symlinked from this checkout
- MCP `clockify-dev` → this checkout's `dist` + `.env`
- `CLOCKIFY_CONFIG_ROOT` = the sandbox

Project MCP often starts **disabled** until you enable it under Customize → MCP.

---

<br>

## Mental model

```text
Directory / npx subscriber     Developer on same machine
─────────────────────────      ─────────────────────────
plugin id: clockify            plugin id: clockify-dev
mcp: npx (unpinned npm)        mcp: dist/ via clockify-dev
skills: Directory Add snapshot skills: from clockify-dev plugin
```

Do not keep a user-scoped MCP pointed at this checkout's `dist` while validating a Directory or npx install. Do not commit a `dev:link`-shaped `mcp.json`.

---

<br>

## MCP tools

The agent calls these; people use skills. Listed here for handshake tests and allowlists (`clockify:*`).

| Tool | Purpose |
|------|---------|
| `clockify_get_config` | Effective `.clockify/config.yml` standards |
| `clockify_get_user` | Authenticated user + workspace IDs |
| `clockify_list_workspaces` | List workspaces |
| `clockify_list_projects` | List / filter projects |
| `clockify_ensure_project` | Find or create project by name |
| `clockify_list_tags` | List tags |
| `clockify_list_tasks` | List tasks on a project |
| `clockify_ensure_task` | Find or create task (e.g. GitHub label) |
| `clockify_get_running_timer` | Current running timer (+ inactivity hint) |
| `clockify_start_timer` | Start a timer (optional start time; description template fields) |
| `clockify_stop_timer` | Stop the running timer (optional rounding) |
| `clockify_create_time_entry` | Create a completed entry (explicit start/end; no rounding) |
| `clockify_list_time_entries` | List entries in a window |
| `clockify_today_summary` | Today's totals by project |

---

<br>

<strong>Clockify MCP Server</strong>
<div align="right">

[MIT License](../LICENSE)

</div>
<br clear="both">
