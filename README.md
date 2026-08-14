<br><br>

<p align="center">
  <img src="assets/logo.svg" alt="Clockify MCP (unofficial)" width="128">
</p>

<br>

<p align="center">
  <img src="https://img.shields.io/badge/status-pre--release-2F4A34?style=flat-square&labelColor=2A2620" alt="Pre-release">
  <img src="https://img.shields.io/badge/stack-TypeScript%20%2F%20MCP-2F4A34?style=flat-square&labelColor=2A2620" alt="TypeScript / MCP">
  <img src="https://img.shields.io/badge/license-MIT-2F4A34?style=flat-square&labelColor=2A2620" alt="MIT">
</p>

<br>

---

Unofficial [Model Context Protocol](https://modelcontextprotocol.io) server and Agent Skills for [Clockify](https://clockify.me) - start/stop timers, map coding work to projects, and summarize sessions in Cursor and other MCP hosts.

**Not affiliated with, endorsed by, or sponsored by Clockify or Cake.com.** Third-party connector only.

---

<br>

## Layout

```text
clockify-mcp-server/
├── .cursor-plugin/plugin.json
├── assets/logo.svg
├── docs/
├── skills/
├── src/
├── mcp.json
├── package.json
└── README.md
```

---

<br>

## Getting started

1. Create a Clockify API key (Preferences → Advanced → Manage API Keys). Optionally pin `CLOCKIFY_WORKSPACE_ID`.
2. Install **clockify** from the [Cursor Marketplace](https://cursor.com/marketplace) (or Customize → Plugins).
3. Set plugin variables when prompted; confirm **Customize → MCP** shows **Clockify** enabled.

```bash
# Local clone instead of Marketplace — see docs
npm install && npm run build
npm run dev:link
```

Credentials detail and non-Cursor hosts: [docs/setup.md](docs/setup.md). Full doc index: [docs/README.md](docs/README.md).

<br>

---

<br>

## Tools

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
| `clockify_start_timer` | Start a timer (supports description template fields) |
| `clockify_stop_timer` | Stop the running timer (optional rounding) |
| `clockify_create_time_entry` | Create a completed entry |
| `clockify_list_time_entries` | List entries in a window |
| `clockify_today_summary` | Today's totals by project |

### Skills

| Skill | Purpose |
|-------|---------|
| [`clockify-coding-time`](skills/clockify-coding-time/SKILL.md) | Daily start/stop/summary; honors `.clockify/config.yml` |
| [`clockify-project-init`](skills/clockify-project-init/SKILL.md) | Bootstrap config + ignore defaults + project + label→task sync |
| [`clockify-project-init-automated`](skills/clockify-project-init-automated/SKILL.md) | Wire Cursor rules/hooks from yaml triggers |
| [`clockify-uninit`](skills/clockify-uninit/SKILL.md) | Remove project Clockify artifacts (keep plugin unless asked) |

<br>

---

<br>

## Packaging

| File | Role |
|------|------|
| `.cursor-plugin/plugin.json` | Cursor Plugin / Marketplace |
| `plugin.json` | [Agent Plugins](https://agent-plugins.org) portable manifest |
| `mcp.json` | MCP server entry for plugins |
| `skills/` | [Agent Skills](https://agentskills.io) |

<br>

---

<br>

<strong>Clockify MCP Server</strong>
<div align="right">

[MIT License](LICENSE)

</div>
<br clear="both">
