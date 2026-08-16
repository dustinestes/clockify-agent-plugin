---
name: clockify-coding-time
description: >-
  Integrates coding work with Clockify time tracking via MCP tools. Use when
  starting or stopping focused coding sessions, mapping a repo or branch to a
  Clockify project, logging completed work, summarizing time today, or honoring
  a repo .clockify/config.yml automation contract (issue start/finish/switch,
  inactivity).
---

# Clockify coding time

Use the Clockify MCP tools to connect coding effort with time tracking.

## Prerequisites

- `CLOCKIFY_API_KEY` configured for the MCP server (see repo README → Setup → Clockify credentials)
- Optional `CLOCKIFY_WORKSPACE_ID`
- Optional repo `.clockify/config.yml` (see `docs/config.md`) - call `clockify_get_config` first when present

## Config-aware behavior

1. Call `clockify_get_config`. If `found`, honor per-method description, rounding, triggers, and inactivity.
2. Never invent project/task ids - list or `ensure_*` first.
3. When `description.from` is `template`, pass `issue_number` / `issue_title` / `github_label` so the template applies when `description` is omitted. Default template is `{issue_number} - {issue_title}` → `#N - title`. Do not put a literal `#` before `{issue_number}`. When `from` is `prompt`, ask for or use a caller-supplied description.

## Workflow

### Start (issue_start / explicit track)

1. `clockify_get_running_timer`. If running and `inactivity.pastThreshold`, stop it (or ask) per config.
2. If another issue’s timer is running and the user is switching, stop first (`issue_switch` → stop_then_start).
3. Resolve project: user name, config repo name, or `clockify_list_projects` / `clockify_ensure_project`.
4. Resolve task from the method’s `task.from`. When `github_label`, `clockify_ensure_task` if `if_missing` is `create`; prompt or skip per `if_missing`.
5. `clockify_start_timer` with `project_id`, optional `task_id`, and `issue_number` / `issue_title`.

### Stop (issue_finish / pr_ship / explicit stop)

1. `clockify_stop_timer` (`timer.rounding` on end when enabled). If the tool reports `overlap: true`, ask before retrying with `confirm_overlap: true`.
2. Confirm description, project, duration, and any `rounding` metadata from the response.

### Summarize

- `clockify_today_summary` or `clockify_list_time_entries` for ranges.

### Backfill

- `clockify_create_time_entry` with ISO start/end; `manual.description` applies; do not round. Honor overlap (`confirm_overlap` if `on_conflict` is prompt).

## Mapping guidance

| Coding signal | Clockify field |
|---------------|----------------|
| Git repo name | Project (often via `.clockify/config.yml`) |
| GitHub label | Task when `task.from: github_label` |
| Issue number + title | Description via template |

## Examples

**User:** "Start issue #42 Login redirect bug"

1. `clockify_get_config` / `clockify_get_running_timer`
2. Ensure project + optional task
3. `clockify_start_timer` with `issue_number: 42`, `issue_title: Login redirect bug` (default description: `#42 - Login redirect bug`)

**User:** "Stop tracking" / "We shipped the PR"

1. `clockify_stop_timer`

**User:** "How much did I track today?"

1. `clockify_today_summary`
