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

1. `clockify_get_config`. If `found`, honor `timer.description`, `timer.task`, `timer.rounding` / `include_seconds` (the start tool applies them), and `timer.overlap`.
2. Never invent project/task ids — `clockify_list_projects` / `clockify_ensure_project` / `clockify_ensure_task` first.
3. Description: if `timer.description.from` is `prompt`, ask or use what they said. If `template`, pass `issue_number` / `issue_title` / `github_label` and omit `description` so the template applies. Default template `{issue_number} - {issue_title}` → `#N - title`. Do not put a literal `#` before `{issue_number}`.

## Workflow

1. `clockify_get_running_timer`.
   - Same work already running (same issue / same description): report it. Do **not** stop or start again.
   - Anything else running (including inactivity `pastThreshold`): **do not stop yet.** Show description, project, duration (and inactivity if past threshold). Ask whether to stop it and start the new one. Only stop-then-start after they confirm. If they decline, leave the running timer.
   - Nothing running: continue.
2. Resolve project: user name, config repo name, or list/ensure.
3. Resolve task from `timer.task.from`:
   - `prompt` — ask (or none).
   - `github_label` — `ensure_task` when `if_missing` is `create` and a label is known; `prompt` or skip per `if_missing`. No label → no task.
   - `none` — no task.
4. `clockify_start_timer` with `entry_method: timer`, `project_id`, optional `task_id`, description or issue fields, and optional `start` (ISO) if they asked to backdate.
5. If the tool returns `overlap: true`, show the clash. Retry with `confirm_overlap: true` only if they agree (or `timer.overlap.on_conflict` is `override`).

## Examples

**User:** "Start issue #42 Login redirect bug"

1. Config + running timer check (warn if another timer is up).
2. Ensure project + optional task.
3. `clockify_start_timer` with `entry_method: timer`, `issue_number: 42`, `issue_title: Login redirect bug` when `from` is `template`.
