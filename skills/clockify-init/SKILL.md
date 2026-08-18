---
name: clockify-init
description: >-
  Bootstrap Clockify for a git repo: write .clockify/config.yml, default-ignore
  personal time-tracking files, ensure a Clockify project named like the repo,
  and sync GitHub labels to Clockify tasks when task.from is github_label. Use
  when setting up time tracking (timer or enter-time). Safe to re-run: does not
  overwrite existing config unless the user asks. Does not enable agent
  automation — that is clockify-automate.
disable-model-invocation: true
---

# Clockify init

Set up the repo contract so timer and enter-time tools share one yaml. Config is **personal by default** (gitignored) so product repos stay clean.

Optional next mode: [`clockify-automate`](../clockify-automate/SKILL.md) wires Cursor rules/hooks. Do not write those here.

## Idempotency

Re-runs are expected (including from `clockify-automate`). Treat existing setup as authoritative:

1. Confirm MCP auth: `clockify_get_user` (fix if missing API key).
2. Detect repo name (git root / folder name). Prefer `CLOCKIFY_CONFIG_ROOT` = workspace folder.
3. If `.clockify/config.yml` exists (or `clockify_get_config` returns `found: true` at that path):
   - **Do not** rewrite config, `.managed-by-init`, or `.clockify/.gitignore` unless the user explicitly asks to reset/overwrite.
   - **Do not** re-prompt for `workspace_id` when config already exists unless the user asks to change it.
   - Only fill **missing** ignore pieces (step 9), then jump to verify + ensure (steps 11–14).
4. Otherwise continue with first-time bootstrap below.

`.clockify/.managed-by-init` marks layout ownership for `clockify-uninit`; its presence alone is not required to skip — existing `config.yml` is the primary “already inited” signal.

## First-time bootstrap

5. `clockify_list_workspaces` — build a numbered menu and ask the user to choose (use **AskQuestion** when available):

   ```text
   Choose the Clockify workspace for this repo:
   0 - None (use active workspace)
   1 - Workspace A Name (abc123...)
   2 - Workspace B Name (def456...)
   ```

   Write the chosen id into `workspace_id` in the yaml (omit the key for option 0).

6. Write `.clockify/config.yml` (start from the plugin’s `.clockify/config.yml.example` unless the user specifies different rounding/template/triggers).
7. Write `.clockify/.managed-by-init` (empty marker).
8. Write `.clockify/.gitignore` with a single line: `*` (directory self-ignore so even `git add .` skips personal files).

## Always (first-time and re-run)

9. Ensure repo `.gitignore` has this managed block if missing (idempotent — skip when the comment or `.clockify/` entry already exists; do **not** rewrite the whole file):

   ```gitignore
   # Clockify Agent Plugin — personal time-tracking (delete this block to share with the team)
   .clockify/
   .cursor/rules/clockify-time.mdc
   ```

10. If `.clockify/` is **already tracked** in git, warn and ask before `git rm --cached`; never force-add `.clockify/` to the index.
11. `clockify_get_config` - confirm `found: true`, path under `.clockify/config.yml`, and expected `projectName`.
12. `clockify_ensure_project` - create/find project matching the repo name.
13. Sync GitHub labels → Clockify tasks (when any method has `task.from: github_label`):
    - `gh label list --json name` (or GitHub API)
    - For each label: `clockify_ensure_task` with `project_id` + label `name`
14. Summarize: whether this was first-time vs already present, config path, **ignored by default**, how to opt in (delete the managed gitignore stanza and commit on purpose), project id, tasks created vs existing. Mention `clockify-automate` if they want agent-mediated start/stop.

## Do not

- Put API keys in `.clockify/config.yml` (or anywhere under `.clockify/`)
- Invent Clockify ids
- Force-add `.clockify/` to git
- Overwrite an existing `.clockify/config.yml` without an explicit user request
- Enable automated Cursor rules here — that is `clockify-automate`

## Default yaml (unless user overrides)

Copy the plugin `.clockify/config.yml.example`. That file has `timer` / `manual` / `automated` blocks: project from repo name, prompt vs template descriptions, nearest-15 rounding on timer and automated, overlap `prompt`, automated triggers (issue_start → start; issue_finish / pr_ship / pr_closed → stop; issue_switch → stop_then_start), inactivity 45 minutes (`stop_after_minutes` is a positive int you can set to 15 or any other value).
