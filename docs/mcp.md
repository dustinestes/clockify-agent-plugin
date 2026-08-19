<br><br>
<img align="right" src="../assets/logo.svg" height="40" alt="Clockify Agent Plugin">
<h1>MCP</h1>
<br clear="both">

Clockify Agent Plugin MCP tools and other configuration information.

<br>

## Contents

- [Contents](#contents)
- [Tools](#tools)

---

<br>

## Tools

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

Which of these honor yaml: [schema — tools that honor config](./schema/config.yml.md#tools-that-honor-config).

---

<br>

---

<strong>Clockify Agent Plugin</strong>
<div align="right">

[MIT License](../LICENSE)

</div>
<br clear="both">
