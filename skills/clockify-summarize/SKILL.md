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

1. Default range is **today** via `clockify_today_summary`.
2. For another window, `clockify_list_time_entries` with ISO `start` / `end`, then totals by project. Do not invent project ids; names come from the tool response or `clockify_list_projects`.
3. If a timer is still running, mention it (duration so far) but do not stop it.
4. Do not create or edit entries.
