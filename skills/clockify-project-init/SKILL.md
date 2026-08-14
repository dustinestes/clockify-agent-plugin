---
name: clockify-project-init
description: >-
  Bootstrap Clockify standards for a git repo: write .clockify/config.yml,
  default-ignore personal time-tracking files, ensure a Clockify project named
  like the repo, and sync GitHub labels to Clockify tasks. Use when setting up
  time tracking for a new or existing project (manual workflow). Safe to re-run:
  does not overwrite existing config unless the user asks.
---

# Clockify project init

Set up taxonomy and formatting so coding-time tools share one contract. Config is **personal by default** (gitignored) so product repos stay clean.

## Idempotency

Re-runs are expected (e.g. from `clockify-project-init-automated`). Treat existing setup as authoritative:

1. Confirm MCP auth: `clockify_get_user` (fix if missing API key).
2. Detect repo name (git root / folder name). Prefer `CLOCKIFY_CONFIG_ROOT` = workspace folder.
3. If `.clockify/config.yml` exists (or `clockify_get_config` returns `found: true` at that path):
   - **Do not** rewrite config, `.managed-by-init`, or `.clockify/.gitignore` unless the user explicitly asks to reset/overwrite.
   - Only fill **missing** ignore pieces (step 6), then jump to verify + ensure (steps 8–11).
4. Otherwise continue with first-time bootstrap below.

`.clockify/.managed-by-init` marks layout ownership for `clockify-uninit`; its presence alone is not required to skip — existing `config.yml` is the primary “already inited” signal.

## First-time bootstrap

5. Write `.clockify/config.yml` (start from the plugin’s `.clockify/config.yml.example` unless the user specifies different rounding/template/triggers).
6. Write `.clockify/.managed-by-init` (empty marker).
7. Write `.clockify/.gitignore` with a single line: `*` (directory self-ignore so even `git add .` skips personal files).

## Always (first-time and re-run)

8. Ensure repo `.gitignore` has this managed block if missing (idempotent — skip when the comment or `.clockify/` entry already exists; do **not** rewrite the whole file):

   ```gitignore
   # Clockify MCP — personal time-tracking (delete this block to share with the team)
   .clockify/
   .cursor/rules/clockify-time.mdc
   ```

9. If `.clockify/` is **already tracked** in git, warn and ask before `git rm --cached`; never force-add `.clockify/` to the index.
10. `clockify_get_config` - confirm `found: true`, path under `.clockify/config.yml`, and expected `projectName`.
11. `clockify_ensure_project` - create/find project matching the repo name.
12. Sync GitHub labels → Clockify tasks (when `mapping.task_from: github_label`):
    - `gh label list --json name` (or GitHub API)
    - For each label: `clockify_ensure_task` with `project_id` + label `name`
13. Summarize: whether this was first-time vs already present, config path, **ignored by default**, how to opt in (delete the managed gitignore stanza and commit on purpose), project id, tasks created vs existing.

## Do not

- Put API keys in `.clockify/config.yml` (or anywhere under `.clockify/`)
- Invent Clockify ids
- Force-add `.clockify/` to git
- Overwrite an existing `.clockify/config.yml` without an explicit user request
- Enable automated Cursor rules here - that is `clockify-project-init-automated`

## Default yaml (unless user overrides)

- Project from repo name
- Description `{issue_number} {issue_title}`
- Rounding nearest 15 minutes
- Triggers: issue_start → start; issue_finish / pr_ship → stop; issue_switch → stop_then_start
- Inactivity stop after 45 minutes (skill/hook enforced)
