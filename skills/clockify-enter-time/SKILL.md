---
name: clockify-enter-time
description: >-
  Create a completed Clockify time entry with an explicit start and end (Clockify
  Manual). Use when the user logs a range, backfills forgotten time, or does not
  want a running timer. Does not round. Infers a window only when times are
  omitted, and always confirms before writing.
---

# Clockify enter time

**Manual** method: `clockify_create_time_entry` with `entry_method: manual`. Typed times stay exact.

## Config-aware behavior

1. If `config_root` is already known this session and still this repo, reuse it. Otherwise resolve once with `git rev-parse --show-toplevel` from the working directory (open tabs are not required; multi-root: focused path only as a tie-breaker). Re-resolve when the folder or focused root changes. Pass that string on Clockify MCP calls — do not run git before every tool.
2. `clockify_get_config` with `config_root`. Honor `manual.description`, `manual.task`, `manual.overlap`. Do **not** apply rounding.
3. Never invent project/task ids.

## Workflow

1. `clockify_get_running_timer` with `config_root`. If a timer is already running for this same work, do not double-count — point at `clockify-stop-timer`.
2. Resolve project (list/ensure). Resolve task from `manual.task.from` / `if_missing` (same rules as start-timer: prompt, github_label, repo, or none).
3. Description: ask or use their text (`manual.description.from` is always `prompt`; no issue templates).
4. **Times given** (e.g. 09:30–09:45): convert to ISO and create. Do not round.
5. **Times omitted** (forgot to track): infer start from cheap signals — git log / branch checkout, conversation timestamps, recent file edits. End defaults to now unless they give one. **Show the inferred window and confirm.** Never silently log hours.
6. `clockify_create_time_entry` with `config_root` and `entry_method: manual`. If `overlap: true`, show the clash. Retry with `confirm_overlap: true` only if they agree (or `on_conflict` is `override`). Override is how parallel completed streams can stack; do not treat that as the default.

## Examples

**User:** "Log 9:30 to 10:15 on the login bug"

1. Config + running-timer check.
2. Create entry with those times, no rounding.
