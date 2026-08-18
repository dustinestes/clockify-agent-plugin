---
name: clockify-summarize
description: >-
  Summarize Clockify time for today or a date range (totals by project, entry
  count). Use when the user asks how much they tracked, a timesheet snapshot,
  or today's Clockify summary. Does not start or stop timers.
---

# Clockify summarize

Review only. Independent of timer vs enter-time.

## Workflow

1. If `config_root` is already known this session and still this repo, reuse it. Otherwise resolve once with `git rev-parse --show-toplevel` from the working directory (open tabs are not required; multi-root: focused path only as a tie-breaker). Re-resolve when the folder or focused root changes. Pass that string on Clockify MCP calls — do not run git before every tool.
2. Default range is **today** via `clockify_today_summary` with `config_root`.
3. For another window, `clockify_list_time_entries` with `config_root` and ISO `start` / `end`, then totals by project. Do not invent project ids; names come from the tool response or `clockify_list_projects`.
4. If a timer is still running, mention it (duration so far) but do not stop it.
5. Do not create or edit entries.
