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

1. `clockify_get_running_timer`.
2. If running: report description, project, task, start time, duration so far, and inactivity (`pastThreshold`) when `automated.inactivity` is enabled.
3. If nothing is running, say so clearly.
4. Do **not** start, stop, or create entries. Offer `clockify-start-timer`, `clockify-stop-timer`, or `clockify-enter-time` if they want to act.
