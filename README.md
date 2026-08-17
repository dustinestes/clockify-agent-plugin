<br><br>

<p align="center">
  <img src="assets/lockup-light.svg#gh-light-mode-only" alt="Clockify Agent Plugin" height="64">
  <img src="assets/lockup-dark.svg#gh-dark-mode-only" alt="Clockify Agent Plugin" height="64">
</p>

<br>

<p align="center">
  <img src="https://img.shields.io/badge/status-pre--release-2F4A34?style=flat-square&labelColor=2A2620" alt="Pre-release">
  <img src="https://img.shields.io/badge/stack-TypeScript%20%2F%20MCP-2F4A34?style=flat-square&labelColor=2A2620" alt="TypeScript / MCP">
  <img src="https://img.shields.io/badge/license-MIT-2F4A34?style=flat-square&labelColor=2A2620" alt="MIT">
</p>

<br>

---

Unofficial Cursor plugin for [Clockify](https://clockify.me): [MCP](https://modelcontextprotocol.io) tools plus Agent Skills — start/stop timers, enter time, and summarize sessions in Cursor and other MCP hosts.

**Not affiliated with, endorsed by, or sponsored by Clockify or Cake.com.** Third-party connector only.

---

<br>

## Getting started

1. Create a Clockify API key (Preferences → Advanced → Manage API Keys).
2. Install **Clockify** from [cursor.directory](https://cursor.directory) (Add to Cursor), or wire `npx -y @dustinestes/clockify-mcp-server` in MCP config.
3. Set `CLOCKIFY_API_KEY` when prompted; confirm **Customize → MCP** shows **Clockify** enabled.
4. Optional: [pre-allow Clockify MCP tools](docs/getting-started.md#pre-enable-clockify-tools) so agents do not stall on an Allow / Always allow prompt mid-run.

Credentials, allowlists, and non-Cursor hosts: [docs/getting-started.md](docs/getting-started.md).

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
| `clockify_start_timer` | Start a timer (optional start time; description template fields) |
| `clockify_stop_timer` | Stop the running timer (optional rounding) |
| `clockify_create_time_entry` | Create a completed entry (explicit start/end; no rounding) |
| `clockify_list_time_entries` | List entries in a window |
| `clockify_today_summary` | Today's totals by project |

### Skills

| Group | Skill | Purpose |
|-------|-------|---------|
| Repo | [`clockify-init`](skills/clockify-init/SKILL.md) | Config + ignore + project + label→task sync |
| Repo | [`clockify-uninit`](skills/clockify-uninit/SKILL.md) | Full local teardown (keep plugin unless asked) |
| Mode | [`clockify-automate`](skills/clockify-automate/SKILL.md) | Agent mode on: Cursor rules/hooks from `automated.triggers` |
| Mode | [`clockify-unautomate`](skills/clockify-unautomate/SKILL.md) | Agent mode off: remove rule/hooks; keep `.clockify/` |
| Timer | [`clockify-start-timer`](skills/clockify-start-timer/SKILL.md) | Start a running timer (`entry_method: timer`) |
| Timer | [`clockify-stop-timer`](skills/clockify-stop-timer/SKILL.md) | Stop the running timer |
| Timer | [`clockify-status`](skills/clockify-status/SKILL.md) | Read-only running timer (or none) |
| Time | [`clockify-enter-time`](skills/clockify-enter-time/SKILL.md) | Completed range, no rounding (`entry_method: manual`) |
| Review | [`clockify-summarize`](skills/clockify-summarize/SKILL.md) | Today / range totals |

<br>

---

<br>

## Developing

Working on this repo: [docs/develop.md](docs/develop.md). Shipping a release or Directory listing: [docs/publish.md](docs/publish.md). How to contribute: [CONTRIBUTING.md](CONTRIBUTING.md).

<br>

---

<br>

<strong>Clockify Agent Plugin</strong>
<div align="right">

[MIT License](LICENSE)

</div>
<br clear="both">
