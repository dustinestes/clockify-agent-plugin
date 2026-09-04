<br><br>
<img align="right" src="../assets/logo.svg" height="40" alt="Clockify Agent Plugin">
<h1>MCP</h1>
<br clear="both">

Clockify Agent Plugin MCP tools and other configuration information.

<br>

## Contents

- [Contents](#contents)
- [Tools](#tools)
- [Logging](#logging)

---

<br>

## Tools

| Tool | Purpose |
|------|---------|
| `clockify_get_config` | Effective `.clockify/config.yml` standards (miss payload includes `tried` paths) |
| `clockify_get_user` | Authenticated user + workspace IDs |
| `clockify_list_workspaces` | List workspaces |
| `clockify_list_projects` | List / filter projects |
| `clockify_list_clients` | List active clients in a workspace |
| `clockify_create_client` | Create a client (automate Create Client path; name from chat) |
| `clockify_set_project_client` | Assign client to existing project without one (PUT full project body) |
| `clockify_ensure_project` | Find or create project by name (`client_id` on create only) |
| `clockify_list_tags` | List tags |
| `clockify_list_tasks` | List tasks on a project |
| `clockify_ensure_task` | Find or create task (e.g. forge label name) |
| `clockify_get_running_timer` | Current running timer (+ inactivity hint) |
| `clockify_start_timer` | Start a timer (optional start; `entry_method`; `cursor_mode`; template fields including `label`) |
| `clockify_stop_timer` | Stop the running timer (optional rounding) |
| `clockify_create_time_entry` | Create a completed entry (explicit start/end; no rounding) |
| `clockify_list_time_entries` | List entries in a window |
| `clockify_today_summary` | Today's totals by project |

**`clockify_start_timer` notes**

- `entry_method`: `timer` (default) or `automated` — selects which yaml block for include_seconds, rounding, overlap, and description/task resolution.
- `cursor_mode`: `plan` or `debug` — when `entry_method` is `automated`, resolve description/task from `platforms.cursor.modes.<mode>` instead of forge `on_start`.
- Template fields when description/task use templates: `issue_number`, `issue_title`, `label` (deprecated alias `github_label`), plus `plan_title` / `debug_title` for `{planTitle}` / `{debugTitle}` on Cursor mode templates.
- Pass `config_root` so user-scoped MCP finds `.clockify/config.yml` ([config.md](./config.md#which-repo-config_root)).

Which of these honor yaml: [schema — tools that honor config](./schema/config.yml.md#tools-that-honor-config).

---

<br>

## Logging

Tool success/failure and process lifecycle go to stderr as JSON lines. Where to open them in Cursor, `CLOCKIFY_MCP_LOG` levels, and the `msg` catalog: [logging.md](./logging.md). Symptom-oriented steps (red toggle, Node PATH): [troubleshoot.md](./troubleshoot.md).

---

<br>

---

<strong>Clockify Agent Plugin</strong>
<div align="right">

[MIT License](../LICENSE)

</div>
<br clear="both">
