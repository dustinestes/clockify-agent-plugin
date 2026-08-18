---
name: clockify-status
description: >-
  Report whether a Clockify timer is running and its metadata (description,
  project, task, start, duration, inactivity). Use when the user asks if they
  are tracking, what is running, or timer status. Read-only.
---

# Clockify status

Read-only check so the user does not need the Clockify UI.

## Workflow

1. If `config_root` is already known this session and still this repo, reuse it. Otherwise resolve once with `git rev-parse --show-toplevel` from the working directory (open tabs are not required; multi-root: focused path only as a tie-breaker). Re-resolve when the folder or focused root changes. Pass that string on Clockify MCP calls — do not run git before every tool.
2. `clockify_get_running_timer` with `config_root`.
3. If running: report description, project, task, start time, duration so far, and inactivity (`pastThreshold`) when `automated.inactivity` is enabled.
4. If nothing is running, say so clearly.
5. Do **not** start, stop, or create entries. Offer `clockify-start-timer`, `clockify-stop-timer`, or `clockify-enter-time` if they want to act.
