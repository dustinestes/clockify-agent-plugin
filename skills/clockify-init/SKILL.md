---
name: clockify-init
description: >-
  Bootstrap Clockify for a git repo: AskQuestion for workspace then taxonomy
  shape (0 local-only, 1 repo as project, 2 repo as task), write
  .clockify/config.yml, default-ignore personal time-tracking files, and only
  then ensure Clockify project/tasks when a shape that maps into Clockify is
  chosen. Use when setting up time tracking (timer or enter-time). Safe to
  re-run: does not overwrite existing config unless the user asks. Does not
  enable agent automation — that is clockify-automate.
disable-model-invocation: true
---

# Clockify init

Set up the repo contract so timer and enter-time tools share one yaml. Config is **personal by default** (gitignored) so product repos stay clean.

Optional next mode: [`clockify-automate`](../clockify-automate/SKILL.md) wires Cursor rules/hooks. Do not write those here.

## Config root

Pass `config_root` (absolute git toplevel) on Clockify MCP calls. If it is already known this session and still this repo, **reuse it** — do not run git before every tool. Otherwise resolve once:

1. `git rev-parse --show-toplevel` from the working directory (no path argument). Open editor tabs are not required.
2. If that fails, the same command from the folder this Cursor window opened.
3. Multi-root `.code-workspace` only: git-toplevel the focused file or explorer folder.
4. Still ambiguous: ask which root, or look for `.clockify/config.yml` under each root. Do not guess the `.code-workspace` parent.

Re-resolve when the user switches folders or the focused root changes.

## Idempotency

Re-runs are expected (including from `clockify-automate`). Treat existing setup as authoritative:

1. Confirm MCP auth: `clockify_get_user` with `config_root` (fix if missing API key).
2. Detect repo name from that git toplevel (folder name). Do not use Cursor’s workspace folder when it is a multi-root `.code-workspace` parent.
3. If `.clockify/config.yml` exists (or `clockify_get_config` with `config_root` returns `found: true` at that path):
   - **Do not** rewrite config, `.managed-by-init`, or `.clockify/.gitignore` unless the user explicitly asks to reset/overwrite.
   - **Do not** re-prompt for `workspace_id` or **shape** when config already exists unless the user asks to change them.
   - Only fill **missing** ignore pieces (step 11), then jump to verify + conditional ensure (steps 13–17).
4. Otherwise continue with first-time bootstrap below.

`.clockify/.managed-by-init` marks layout ownership for `clockify-uninit`; its presence alone is not required to skip — existing `config.yml` is the primary “already inited” signal.

## First-time bootstrap

5. `clockify_list_workspaces` with `config_root` — build a numbered menu and ask the user to choose (use **AskQuestion** when available):

   ```text
   Choose the Clockify workspace for this repo:
   0 - None (use active workspace)
   1 - Workspace A Name (abc123...)
   2 - Workspace B Name (def456...)
   ```

   Write the chosen id into `workspace_id` in the yaml (omit the key for option 0).

6. Ask how this repo maps into Clockify (**AskQuestion** when available) **before** writing final yaml or calling ensure:

   ```text
   Choose how this repo maps into Clockify:
   0 - None (write local config only; do not create/ensure project or tasks yet)
   1 - Repo as project (project = repo folder; GitHub labels → tasks)
   2 - Repo as task (fixed Clockify project; task = repo folder)
   ```

7. If shape **2**: ask for the shared Clockify **project name**. Prefer **AskQuestion** with **only concrete names** (existing Clockify projects in the chosen workspace, and/or a clearly labeled folder-name guess). **Do not add an “Other” option** — AskQuestion already injects one; a second Other is duplicate UX. If they pick the built-in Other, wait for the name in chat (or the “Add more optional details” field). That value is `project.name`. Do not invent a name.

8. Write `.clockify/config.yml`: start from the plugin’s `.clockify/config.yml.example` (rounding, triggers, inactivity) unless the user specifies different values, then overlay the shape (see [Shape overlays](#shape-overlays)). Apply `workspace_id` from step 5.

9. Write `.clockify/.managed-by-init` (empty marker).
10. Write `.clockify/.gitignore` with a single line: `*` (directory self-ignore so even `git add .` skips personal files).

## Always (first-time and re-run)

11. Ensure repo `.gitignore` has this managed block if missing (idempotent — skip when the comment or `.clockify/` entry already exists; do **not** rewrite the whole file):

   ```gitignore
   # Clockify Agent Plugin — personal time-tracking (delete this block to share with the team)
   .clockify/
   .cursor/rules/clockify.mdc
   ```

12. If `.clockify/` is **already tracked** in git, warn and ask before `git rm --cached`; never force-add `.clockify/` to the index.
13. `clockify_get_config` with `config_root` — confirm `found: true`, path under `.clockify/config.yml`, expected `projectName`, and `repoName` (folder name). If `found: false`, the file is actually missing (user-scoped MCP cwd is not the repo).
14. **Ensure only when the yaml commits to a Clockify shape.** Detect:

    | Shape | Detect from existing yaml | Mutations |
    |-------|---------------------------|-----------|
    | **1** Repo as project | `project.from: repo` **and** any method `task.from: github_label` | `clockify_ensure_project`, then label → task sync |
    | **2** Repo as task | `project.from: fixed` **and** any method `task.from: repo` | `clockify_ensure_project`, then one repo-named task |
    | **0** Local only | otherwise (example: `project.from: repo` with interactive `task.from: prompt` and `automated.task.from: none`) | **Skip** ensure_project and all task ensure |

    First-time shape **0**, and re-runs of that yaml, must **not** create a Clockify project or tasks. Do not call `clockify_ensure_project` “just in case.”

15. When shape **1** (or yaml matches that row): `clockify_ensure_project` with `config_root` (`project.from: repo` → folder name / `projectName`). Then sync GitHub labels → Clockify tasks:
    - `gh label list --json name` (or GitHub API)
    - For each label: `clockify_ensure_task` with `config_root`, `project_id` + label `name`
    - If there are no remotes or labels, skip task create and say so — still keep the project if ensure ran.
16. When shape **2** (or yaml matches that row): `clockify_ensure_project` with `config_root` (`fixed` → `project.name`). Then `clockify_ensure_task` once with `config_root`, `project_id`, and `repoName` from get_config.
17. Summarize: first-time vs already present, **shape chosen** (or detected), config path, **ignored by default**, how to opt in (delete the managed gitignore stanza and commit on purpose). If shape 0: local files only, no Clockify project/tasks; they can re-run after editing yaml toward shape 1 or 2, or ask to reset config. If shape 1/2: project id, tasks created vs existing. Mention `clockify-automate` if they want agent-mediated start/stop.

Optional client picker (when implemented): only after shape 1 or 2, and only when ensuring a new project — never on shape 0.

## Shape overlays

Copy `.clockify/config.yml.example`, then set:

**0 — None (local only)** — leave the example as-is: `project.from: repo`; timer/manual `task.from: prompt`; **`automated.task.from: none`**. Do not call ensure.

**1 — Repo as project** — `project.from: repo`. For **timer, manual, and automated**:

```yaml
task:
  from: github_label
  if_missing: create
```

Timer and automated `description.from: template` with `template: "{issue_number} - {issue_title}"` (manual stays `prompt`). Then ensure project + label sync.

**2 — Repo as task** — `project.from: fixed` and `project.name` from step 7. For **timer, manual, and automated**:

```yaml
task:
  from: repo
  if_missing: create
```

Same description overlay as shape 1. Then ensure fixed project + repo-named task.

## Do not

- Put API keys in `.clockify/config.yml` (or anywhere under `.clockify/`)
- Invent Clockify ids
- Force-add `.clockify/` to git
- Overwrite an existing `.clockify/config.yml` without an explicit user request
- Enable automated Cursor rules here — that is `clockify-automate`
- Ensure project or tasks before the user answers the shape question
- Add a custom “Other” AskQuestion choice (the UI already provides one)

## Default yaml (unless user overrides)

Copy the plugin `.clockify/config.yml.example` as the **local-only (shape 0)** scaffold, then overlay shape 1 or 2 as above. That file has `timer` / `manual` / `automated` blocks: project from repo name, prompt vs template descriptions, nearest-15 rounding on timer and automated, overlap `prompt`, automated triggers (issue_start → start; issue_finish / pr_ship / pr_closed → stop; issue_switch → stop_then_start), inactivity 45 minutes (`stop_after_minutes` is a positive int you can set to 15 or any other value), **`automated.task.from: none`** so copying it does not imply label→task create.
