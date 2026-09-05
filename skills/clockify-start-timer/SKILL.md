---
name: clockify-start-timer
description: >-
  Start a Clockify running timer for the current repo. Use when the user asks
  to start tracking, clock in, or start a timer on an issue. Honors the timer
  block in .clockify/config.yml. Warns before stopping a different running
  timer. Optional backdated start.
---

# Clockify start timer

Interactive **Timer** method (`entry_method: timer`). Agent-mediated starts belong to `clockify-automate` (that path passes `entry_method: automated`).

## Config-aware behavior

1. If `config_root` is already known this session and still this repo, reuse it. Otherwise resolve once with `git rev-parse --show-toplevel` from the working directory (open tabs are not required; multi-root: focused path only as a tie-breaker; non-git: Cursor window folder). Re-resolve when the folder or focused root changes. Pass that string on Clockify MCP calls — do not run git before every tool.
2. `clockify_get_config` with `config_root`. If `found`, honor `entry.timer.description`, `entry.timer.task`, `entry.timer.rounding` / `include_seconds` (the start tool applies them), and `entry.timer.overlap`.
3. Never invent project/task ids — `clockify_list_projects` / `clockify_ensure_project` / `clockify_ensure_task` first (all with `config_root`).
4. Description: if `entry.timer.description.from` is `prompt`, ask or use what they said. If `template`, pass `issue_number` / `issue_title` / `label` and omit `description` so the template applies. Default template `{issue_number} - {issue_title}` → `#N - title`. Do not put a literal `#` before `{issue_number}`.

## Workflow

1. `clockify_get_running_timer` with `config_root`.
   - Same work already running (same issue / same description): report it. Do **not** stop or start again.
   - Anything else running (including inactivity `pastThreshold`): **do not stop yet.** Show description, project, duration (and inactivity if past threshold). Ask whether to stop it and start the new one. Only stop-then-start after they confirm. If they decline, leave the running timer.
   - Nothing running: continue.
2. Resolve project: user name, config `local_folder` name, or list/ensure.
3. Resolve task from `entry.timer.task.from` — **never block the start waiting on a task.** A missing task is fine; a missing time entry is not. They can assign a task later in Clockify.
   - `none` — no task.
   - `prompt` — use a task only if they already named one in this request; otherwise start with **no** `task_id`. Do **not** AskQuestion for a task name.
   - `template` — expand the task template (e.g. `{label}`); `ensure_task` when `if_missing` is `create` and the resolved name is known. Empty `{label}` or unresolved → start with no task (treat `if_missing: prompt` as skip, not ask).
   - `local_folder` — use local folder name from `clockify_get_config`. `ensure_task` when `if_missing` is `create`; if ensure cannot run, start without a task rather than waiting.
   - `fixed` — use `task.name`; `ensure_task` when `if_missing` is `create`. If the name is missing, start without a task.
4. `clockify_start_timer` with `config_root`, `entry_method: timer`, `project_id`, optional `task_id`, description or issue fields / `label`, and optional `start` (ISO) if they asked to backdate.
5. If the tool returns `overlap: true`, show the clash. Retry with `confirm_overlap: true` only if they agree (or `entry.timer.overlap.on_conflict` is `override`).

## Examples

**User:** "Start issue #42 Login redirect bug"

1. Config + running timer check (warn if another timer is up).
2. Ensure project + optional task.
3. `clockify_start_timer` with `config_root`, `entry_method: timer`, `issue_number: 42`, `issue_title: Login redirect bug` when `from` is `template`.
