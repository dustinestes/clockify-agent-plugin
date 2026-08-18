<br><br>
<img align="right" src="../assets/logo.svg" height="40" alt="Clockify Agent Plugin">
<h1>Develop</h1>
<br clear="both">

How to change this plugin. Edit and build in this checkout. Play against those changes in a disposable sandbox. Test a consumer install with the same script subscribers use.

<br>

## Contents

- [Contents](#contents)
- [Repo layout](#repo-layout)
- [Build](#build)
- [Sandbox](#sandbox)
- [Consumer-like install](#consumer-like-install)
- [MCP tools](#mcp-tools)

---

<br>

## Repo layout

Directory scans `.mcp.json` and `skills/*/SKILL.md` only. It does not read this section.

```text
clockify-agent-plugin/
├── .cursor-plugin/plugin.json   # Cursor plugin + variables
├── .mcp.json                    # Directory MCP discovery (npx)
├── assets/
├── docs/
├── skills/                      # Agent Skills (Directory snapshot)
├── src/                         # MCP server
├── mcp.json                     # plugin MCP entry (npx; same shape as .mcp.json)
├── package.json
└── README.md
```

`mcp.json` stays the unpinned npx shape. Do not point it at `dist/`.

---

<br>

## Build

```bash
npm install
npm run build
```

`dist/` and `node_modules/` are normal TypeScript / npm artifacts. They are gitignored. The sandbox does **not** get its own `dist/` — it runs this checkout’s build.

A gitignored `.env` with **only** `CLOCKIFY_API_KEY` is enough for sandbox MCP (`envFile`) and `smoke:live`. Pin the workspace in each test repo’s `.clockify/config.yml` (via `/clockify-init`). The server does not auto-load `.env`.

---

<br>

## Sandbox

A disposable temp repo that points at this checkout’s `dist/`. It does **not** rewrite `~/.cursor/mcp.json` or this repo’s `mcp.json`.

```bash
npm run build
npm run install:cursor -- --sandbox
```

Prints an absolute path under `$TMPDIR/clockify-agent-plugin-sandbox`. Open that folder in a **separate** Cursor window.

| What | Where |
|------|--------|
| Skills | sandbox `.cursor/skills/` → this checkout’s `skills/` |
| MCP | sandbox `.cursor/mcp.json` → `dist/index.js` + checkout `.env` |
| Config | `CLOCKIFY_CONFIG_ROOT` = the sandbox (consumer path is tool arg `config_root`; see [config.md](./config.md)) |

Project MCP often starts **disabled**. Enable `clockify-agent-plugin` under Customize → MCP.

After `src/` changes: `npm run build` in this checkout, then reload the sandbox window.

```bash
npm run install:cursor -- --sandbox --teardown
```

OS temp may also vanish on reboot. Re-run `--sandbox` if the folder is gone.

This is not a consumer install. Do not treat a green sandbox MCP as proof that npx / Directory works.

---

<br>

## Consumer-like install

Behave like a subscriber on this machine:

```bash
npm run install:cursor -- --uninstall   # if you had a prior install
npx -y -p @dustinestes/clockify-agent-plugin clockify-cursor-install
```

Or from this checkout: `npm run install:cursor`. Then open any empty repo (not this plugin checkout), reload Cursor, enable MCP, `/clockify-init`. Details: [install-cursor.md](./install-cursor.md).

---

<br>

## MCP tools

The agent calls these; people use skills. Listed here for handshake tests and allowlists (`clockify-agent-plugin:*`). User-scoped MCP should pass `config_root` (git toplevel) on each call — [config.md](./config.md#which-repo-config_root).

| Tool | Purpose |
|------|---------|
| `clockify_get_config` | Effective `.clockify/config.yml` standards (miss payload includes `tried` paths) |
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

<strong>Clockify Agent Plugin</strong>
<div align="right">

[MIT License](../LICENSE)

</div>
<br clear="both">
