---
name: clockify-stop-timer
description: >-
  Stop the currently running Clockify timer. Use when the user asks to stop
  tracking, clock out, or finish an issue/PR in this session. Honors timer
  rounding and overlap. Does not summarize the whole day.
---

# Clockify stop timer

Interactive **Timer** method (`entry_method: timer`).

## Config-aware behavior

1. If `config_root` is already known this session and still this repo, reuse it. Otherwise resolve once with `git rev-parse --show-toplevel` from the working directory (open tabs are not required; multi-root: focused path only as a tie-breaker). Re-resolve when the folder or focused root changes. Pass that string on Clockify MCP calls — do not run git before every tool.
2. `clockify_get_config` with `config_root`. Honor `timer.rounding`, `timer.include_seconds`, and `timer.overlap`.
3. Never invent ids.

## Workflow

1. `clockify_get_running_timer` with `config_root`. If none, say so. Point at `clockify-enter-time` if they meant to log a range they forgot to start.
2. `clockify_stop_timer` with `config_root` and `entry_method: timer`.
3. If the tool returns `overlap: true`, show the colliding entries. Retry with `confirm_overlap: true` only if they agree (or `on_conflict` is `override`).
4. Report description, project, duration, and rounding metadata from the response. Do **not** dump a full-day summary (that is `clockify-summarize`).

## Examples

**User:** "Stop tracking" / "We shipped the PR"

1. `clockify_stop_timer` with `config_root` and `entry_method: timer`.
