---
name: clockify-project-init
description: >-
  Bootstrap Clockify standards for a git repo: write .clockify.yml, ensure a
  Clockify project named like the repo, and sync GitHub labels to Clockify tasks.
  Use when setting up time tracking for a new or existing project (manual workflow).
---

# Clockify project init

Set up taxonomy and formatting so coding-time tools share one contract.

## Steps

1. Confirm MCP auth: `clockify_get_user` (fix if missing API key).
2. Detect repo name (git root / folder name). Prefer `CLOCKIFY_CONFIG_ROOT` = workspace folder.
3. Write `.clockify.yml` at the repo root (start from the plugin’s `.clockify.yml.example` unless the user specifies different rounding/template/triggers).
4. `clockify_get_config` - confirm `found: true` and expected `projectName`.
5. `clockify_ensure_project` - create/find project matching the repo name.
6. Sync GitHub labels → Clockify tasks (when `mapping.task_from: github_label`):
   - `gh label list --json name` (or GitHub API)
   - For each label: `clockify_ensure_task` with `project_id` + label `name`
7. Summarize for the user: config path, project id, tasks created vs existing.

## Do not

- Put API keys in `.clockify.yml`
- Invent Clockify ids
- Enable automated Cursor rules here - that is `clockify-project-init-automated`

## Default yaml (unless user overrides)

- Project from repo name
- Description `{issue_number} {issue_title}`
- Rounding nearest 15 minutes
- Triggers: issue_start → start; issue_finish / pr_ship → stop; issue_switch → stop_then_start
- Inactivity stop after 45 minutes (skill/hook enforced)
