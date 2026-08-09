---
name: clockify-project-init-automated
description: >-
  Extend Clockify project init with AI automation: after .clockify.yml exists,
  install Cursor rules/hooks that start/stop timers on issue_start, issue_finish,
  issue_switch, and pr_ship per automation.triggers. Use when the user wants
  agent-mediated time tracking wired into their issue/PR workflow.
---

# Clockify project init (automated)

Builds on `clockify-project-init`. Run that first (or ensure `.clockify.yml` + project/tasks already exist).

## Contract

Automation is **AI-mediated**. Triggers in `.clockify.yml` are the standard the agent/hooks agree to. Without an agent, the user tracks manually.

Typical issue-centric guardrails (align rules with the user’s git workflow when known):

- New issue per concern; one issue per PR
- Start timer when beginning work or planning against an issue
- Stop when finishing that issue or switching issues
- Stop on ship (`pr_ship`) during the agent session
- `pr_merged` without an agent → phase 2 GitHub Action (document only; do not pretend local MCP receives webhooks)

## Steps

1. `clockify_get_config` - read `automation.triggers` and `inactivity`.
2. Ensure init completed (project + tasks). If not, run `clockify-project-init` flow first.
3. Add or update a Cursor project rule (e.g. `.cursor/rules/clockify-time.mdc`) that instructs the agent to:
   - On starting work / planning for an issue → `clockify_start_timer` with issue fields
   - On finishing issue work or shipping a PR in-session → `clockify_stop_timer`
   - On switching issues → stop then start
   - On session start / resume → `clockify_get_running_timer`; if `inactivity.pastThreshold`, stop (or ask)
4. Optionally add Cursor hooks (`sessionStart` / `sessionEnd` / `stop`) that remind or script the inactivity check - keep fail-open so hooks never block coding if Clockify is down.
5. Tell the user phase 2: merge-without-agent needs a GitHub Action (see `docs/config.md`).

## Rule snippet (adapt to their yaml)

```markdown
# Clockify time (from .clockify.yml)

When the user starts work or planning on a GitHub issue, start a Clockify timer
(issue_number + issue_title; project/task from repo config).

When they finish the issue, switch issues, or ship the PR in this session, stop
the timer. Check running timers for inactivity threshold on session resume.

Use Clockify MCP tools only; never invent project/task ids.
```

## Do not

- Claim timers will stop on GitHub merge without an Action
- Install a background daemon
- Skip writing/verifying `.clockify.yml`
