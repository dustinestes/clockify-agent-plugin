---
name: clockify-automate
description: >-
  Turn on agent-mediated Clockify tracking: if .clockify/config.yml is missing,
  run clockify-init first, then write Cursor rules/hooks from automated.triggers
  (issue_start, issue_finish, issue_switch, pr_ship, pr_closed). Use when the user wants
  the agent to start/stop timers in the issue/PR workflow. Safe to re-run.
disable-model-invocation: true
---

# Clockify automate

Mode on. This is not a second init. If config is already present, skip rewrite and only add Cursor glue.

## Init first (if needed)

If `.clockify/config.yml` is missing (`clockify_get_config` `found: false`), **perform [`clockify-init`](../clockify-init/SKILL.md) in full**. It is idempotent. Then only the steps below. Do not restate or fork that skill’s config/ignore/project/task steps.

If config already exists, do not overwrite it. Continue with After init.

## After init

1. `clockify_get_config` — read `automated.triggers`, `automated.inactivity`, `automated.task`, `automated.overlap`. If `automated.triggers` is empty, stop and point at `.clockify/config.yml.example`.
2. Add or update `.cursor/rules/clockify-time.mdc` so the agent:
   - Passes `entry_method: automated` on `clockify_start_timer` / `clockify_stop_timer`
   - On starting work / planning for an issue → start with issue fields; honor `task.from` / `task.if_missing` (create Clockify tasks from labels; if no label, no task)
   - On finishing issue work, shipping a PR, or closing/abandoning a PR in-session → stop
   - On switching issues → **warn** with the running timer’s description/duration; stop-then-start only after the user confirms
   - On session start / resume → `clockify_get_running_timer`; if `inactivity.pastThreshold`, stop (or ask)
   - If a tool returns `overlap: true`, ask before `confirm_overlap: true` unless `overlap.on_conflict` is `override`
3. Optionally add Cursor hooks (`sessionStart` / `sessionEnd` / `stop`) for the inactivity check — fail-open so hooks never block coding if Clockify is down. Prefer entries clearly owned by Clockify so `clockify-unautomate` can remove them surgically. There is no PR-close Cursor hook; `pr_closed` is the agent rule when the user closes or abandons a PR in this session.

Cursor glue is personal (init already gitignores the rule path). Do not commit rules/hooks unless the team opts in; do not gitignore all of `.cursor/`.

Safe to re-run: update the rule; do not duplicate hook entries.

## Rule snippet

```markdown
# Clockify time (from .clockify/config.yml automated block)

When the user starts work or planning on a GitHub issue, start a Clockify timer
with entry_method: automated (issue_number + issue_title; project/task from
automated.task). If another timer is running, warn and confirm before stopping it.

When they finish the issue, switch issues (after confirm), ship the PR, or close
or abandon the PR in this session, stop the timer with entry_method: automated.
Check running timers for inactivity on session resume. Honor overlap.on_conflict.

Use Clockify MCP tools only; never invent project/task ids.
```

## Do not

- Duplicate `clockify-init` steps here when config already exists
- Treat `pr_merged` as valid — GitHub merge is an unwatched action and is not supported
- Install a background daemon
- Skip init when config, ignore defaults, project, or tasks are missing
