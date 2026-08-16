---
name: clockify-project-init-automated
description: >-
  Run clockify-project-init, then wire Cursor rules/hooks so the agent starts
  and stops timers per automated.triggers (issue_start, issue_finish,
  issue_switch, pr_ship). Use when the user wants agent-mediated time tracking
  in their issue/PR workflow.
---

# Clockify project init (automated)

Composition: **perform [`clockify-project-init`](../clockify-project-init/SKILL.md) in full** (it is idempotent — existing config is not overwritten), then only the steps below. Do not restate or fork that skill’s config/ignore/project/task steps.

## After init

1. `clockify_get_config` — read `automated.triggers` and `automated.inactivity`.
2. Add or update `.cursor/rules/clockify-time.mdc` so the agent:
   - On starting work / planning for an issue → `clockify_start_timer` with issue fields
   - On finishing issue work or shipping a PR in-session → `clockify_stop_timer`
   - On switching issues → stop then start
   - On session start / resume → `clockify_get_running_timer`; if `inactivity.pastThreshold`, stop (or ask)
3. Optionally add Cursor hooks (`sessionStart` / `sessionEnd` / `stop`) for the inactivity check — fail-open so hooks never block coding if Clockify is down. Prefer entries clearly owned by Clockify so `clockify-uninit` can remove them surgically.
4. Note phase 2: merge-without-agent needs a GitHub Action (`docs/config.md`). Local MCP does not receive webhooks.

Cursor glue is personal (init already gitignores the rule path). Do not commit rules/hooks unless the team opts in; do not gitignore all of `.cursor/`.

## Rule snippet

```markdown
# Clockify time (from .clockify/config.yml)

When the user starts work or planning on a GitHub issue, start a Clockify timer
(issue_number + issue_title; project/task from repo config).

When they finish the issue, switch issues, or ship the PR in this session, stop
the timer. Check running timers for inactivity threshold on session resume.

Use Clockify MCP tools only; never invent project/task ids.
```

## Do not

- Duplicate `clockify-project-init` steps here
- Claim timers stop on GitHub merge without an Action
- Install a background daemon
- Skip init (config, ignore defaults, project, tasks)
