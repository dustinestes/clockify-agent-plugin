---
name: clockify-automate
description: >-
  Turn on agent-mediated Clockify tracking: if .clockify/config.yml is missing,
  run minimal clockify-init first, then forge wizard (GitHub) + Cursor Plan/Debug
  platforms, ensure project/tasks, and write Cursor rules from entry.automated
  (on_start, triggers, platforms.cursor). Use when the user wants the agent to
  start/stop timers in the issue/PR workflow and Plan/Debug modes. Safe to re-run.
disable-model-invocation: true
---

# Clockify automate

Mode on. This is not a second init. Wizards configure forge + Cursor platforms, patch yaml, ensure Clockify resources, and write Cursor glue.

## Config root

Pass `config_root` on Clockify MCP calls. If it is already known this session and still this repo, **reuse it** — do not run git before every tool. Otherwise resolve once with `git rev-parse --show-toplevel` from the working directory (open tabs are not required). Non-git: use the Cursor window folder (same as init). In a multi-root workspace, git-toplevel the focused file/folder; if nothing is focused, ask or scan roots for `.clockify/config.yml`. Re-resolve when the focused root changes. Do not pass the `.code-workspace` parent.

## Init first (if needed)

If `.clockify/config.yml` is missing (`clockify_get_config` with `config_root` returns `found: false`), **perform [`clockify-init`](../clockify-init/SKILL.md)** (workspace AskQuestion only, write v3 base yaml, ignore markers). It is idempotent. Then continue below. Do not restate or fork that skill’s config/ignore steps.

If config already exists, do not overwrite the whole file — patch only the `entry.automated` (and `scope.project` when the forge wizard sets it) fields below.

## Forge wizard

Skip this wizard when `entry.automated.forge` is already a real forge (`github` / `gitlab` / `bitbucket`), unless the user asks to reconfigure forge settings. That includes coming back from `/clockify-unautomate` (`enabled: false` but forge still set) — re-enable and refresh triggers/rules without re-asking.

When skipping after unautomate: set `entry.automated.enabled: true`, restore the forge `triggers` list (same five GitHub events as in Patch yaml), and if `platforms.cursor.modes` still has enabled modes, set `platforms.cursor.enabled: true`. Then continue at Ensure / Write Cursor rules.

1. **Forge** — AskQuestion. Only **GitHub** is implemented; present it as the choice (other forges are stubs — do not offer them as working options). Set `entry.automated.forge: github`.

2. **Project** — AskQuestion how `scope.project` resolves:

   ```text
   Choose how the Clockify project is chosen:
   local_folder — project name = git toplevel / folder name
   fixed — you name a Clockify project
   prompt — ask each time
   ```

   - `local_folder` → `scope.project.from: local_folder`
   - `fixed` → `scope.project.from: fixed` and AskQuestion for the project name (concrete existing project names and/or a clearly labeled folder-name guess; no custom “Other” option — AskQuestion already injects one). That value is `scope.project.name`.
   - `prompt` → `scope.project.from: prompt`

3. **on_start description** — AskQuestion:

   ```text
   How should forge timer descriptions be set?
   prompt — agent / caller supplies the string
   template — expand a template with tokens
   ```

   If `template`: offer preset `{issue_number} - {issue_title}` or ask for a custom template string (tokens: `{issue_number}`, `{issue_title}`, `{label}`, `{local_folder}`). Write `entry.automated.on_start.description` accordingly (`from: prompt` or `from: template` + `template`).

4. **on_start task** — AskQuestion:

   ```text
   How should forge timer tasks be set?
   template — expand a template (e.g. {label})
   local_folder — task name = folder name
   fixed — literal task name
   none — no task
   prompt — ask each time
   ```

   - `template` → `from: template` + template string (default suggestion `{label}`; custom allowed). Set `if_missing: create` when using `{label}` or other create-worthy templates unless the user chooses otherwise.
   - `local_folder` → `from: local_folder`, `if_missing: create` (or honor user preference).
   - `fixed` → `from: fixed` + `name` (ask for the name), `if_missing: create`.
   - `none` → `from: none`, `if_missing: none`.
   - `prompt` → `from: prompt`, `if_missing: prompt`.

5. **when_multiple_labels** — Ask only if any chosen `on_start` description or task template contains `{label}`:

   ```text
   When an issue has multiple labels, which label should resolve {label}?
   first — use the first label in forge/API list order
   prompt — ask which label each time
   ```

   Default if skipped: `first`. Write `entry.automated.on_start.when_multiple_labels`.

6. **Client when ensuring project** — Clients are set on the Clockify **project**, not in `config.yml`. After the Clockify **project name** is known (`local_folder` folder name, or `scope.project.name` for fixed; skip client picker when `scope.project.from` is `prompt`), run the client flow before ensure:

   `clockify_list_projects` (name filter) in the **pinned** workspace — do not create yet.

   - **Project found with `clientId` / `clientName`:** skip AskQuestion. Chat `Client: <name> (already set on project)`. Do **not** offer to change or reassign.
   - **Project missing, or found without a client:**

     1. **Always** call `clockify_list_clients` with `config_root` **before** AskQuestion (same pinned workspace).
     2. Build AskQuestion from the result (no `0 -`, `1 -`, … prefixes — AskQuestion letters A, B, C…):

     ```text
     None
     Kevin
     Daniel
     Create Client
     ```

     Use each unarchived client **name** from step 1 between `None` and `Create Client` (label = name only — no ids). **Only** when the list is empty or the call fails: `None` and `Create Client` only.

     - **None:** ensure the project without a client.
     - **Listed client name:** new project → `clockify_ensure_project` with `client_id`. Existing project without client → `clockify_set_project_client` with `project_id` and `client_id` (not `set_client` on ensure).
     - **Create Client:** **only after** they pick this option — ask in **chat** for the new name (not AskQuestion). Then `clockify_create_client` and associate via `client_id` on create or `clockify_set_project_client` on existing.
     - List-clients **error:** still AskQuestion with `None` + `Create Client`; chat `Client: failed to retrieve clients`; continue ensure.
     - Do **not** write client into `config.yml`. Do **not** PATCH a project that already has a client.

## Cursor platforms wizard

Skip when `platforms.cursor.modes` already has mode blocks (even if `platforms.cursor.enabled` is false after unautomate), unless the user asks to reconfigure. On skip after unautomate: set `platforms.cursor.enabled: true` if any mode has `enabled: true`.

Otherwise ask whether to enable Cursor Plan and Debug mode timers (defaults: **yes** for both). Optionally ask to rename the fixed task names (defaults: `agent_planning`, `agent_debug`).

Write under `entry.automated.platforms.cursor`:

- `enabled: true` when either mode is on
- For each enabled mode (`plan` / `debug`), write the **array** trigger shape (same as forge triggers — not a `start:` / `stop:` map):

  ```yaml
  plan:
    enabled: true
    triggers:
      - event: start
        action: start_timer
      - event: stop
        action: stop_timer
    description:
      from: prompt
    task:
      from: fixed
      name: agent_planning
      if_missing: create
  ```

  Same for `debug` with `name: agent_debug` (or the user-chosen names).

If the user declines both modes, leave `platforms.cursor.enabled: false` and `modes: {}`.

## Patch yaml

After wizards, patch `.clockify/config.yml` (do not wipe unrelated keys):

- `entry.automated.enabled: true`
- `entry.automated.forge: github` (from forge wizard)
- `entry.automated.on_start` as answered (including `when_multiple_labels`)
- `entry.automated.triggers` (forge):

  ```yaml
  triggers:
    - event: issue_start
      action: start_timer
    - event: issue_finish
      action: stop_timer
    - event: issue_switch
      action: stop_then_start
    - event: pr_ship
      action: stop_timer
    - event: pr_closed
      action: stop_timer
  ```

- `entry.automated.platforms.cursor` from the Cursor wizard
- `scope.project` from the forge project step when set

Keep rounding, overlap, and inactivity from the base yaml unless the user asks to change them.

## Ensure

1. **Project / client** — When `scope.project.from` is `local_folder` or `fixed`, run the client flow (forge wizard step 6) if not already done this session, then `clockify_ensure_project` with `config_root` (and `client_id` when creating a new project). Skip ensure when `from` is `prompt`.
2. **Forge label tasks** — If any `on_start` description or task template contains `{label}`: `gh label list --json name` (or GitHub API). For each label: `clockify_ensure_task` with `config_root`, `project_id`, and label `name`. If there are no remotes or labels, skip and say so — still keep the project if ensure ran.
3. **local_folder / fixed on_start tasks** — When `on_start.task.from` is `local_folder` or `fixed`, `clockify_ensure_task` once for that name when `if_missing` is `create`.
4. **Cursor fixed tasks** — For each enabled Cursor mode with `task.from: fixed`, `clockify_ensure_task` for that `name`.

## Write Cursor rules

Add or update `.cursor/rules/clockify.mdc` from the **declared** config (triggers + platforms), so the agent:

- Passes `config_root` on Clockify MCP calls: reuse the known git toplevel this session; re-resolve only if the folder or focused root changed (cwd first, not the open file)
- Passes `entry_method: automated` on `clockify_start_timer` / `clockify_stop_timer`
- **Forge starts** honor `entry.automated.on_start` (description + task templates/tokens; resolve `{label}` per `when_multiple_labels`: `first` or AskQuestion `prompt`)
- On starting work on an issue → start (issue fields / template tokens); honor `task.from` / `task.if_missing`
- On finishing issue work, shipping a PR, or closing/abandoning a PR in-session → stop
- On switching issues → **warn** with the running timer’s description/duration; stop-then-start only after the user confirms
- **Plan / Debug:** when starting a timer for that Cursor mode, pass `cursor_mode: plan` or `cursor_mode: debug` on `clockify_start_timer` (mode block overrides forge `on_start`)
- **Plan start** only when there is **no** issue in context; if an issue is in context, use forge `issue_start` instead
- **Build** (leaving Plan) = **stop only** — do not start a Build timer
- Warn before any start that would replace a different running timer (same as `issue_switch`)
- On session start / resume → `clockify_get_running_timer`; if `inactivity.pastThreshold`, stop (or ask)
- If a tool returns `overlap: true`, ask before `confirm_overlap: true` unless `overlap.on_conflict` is `override`

Also:

1. Leftover rename: if `.cursor/rules/clockify-time.mdc` still exists, move its content into `clockify.mdc` (or delete it after writing the new file). Do **not** leave both rule files.
2. In the managed `.gitignore` stanza, ensure `.cursor/rules/clockify.mdc` is listed and drop any `.cursor/rules/clockify-time.mdc` line.
3. Optionally add Cursor hooks (`sessionStart` / `sessionEnd` / `stop`) for the inactivity check — fail-open so hooks never block coding if Clockify is down. Prefer entries clearly owned by Clockify so `clockify-unautomate` can remove them surgically. There is no PR-close Cursor hook; `pr_closed` is the agent rule when the user closes or abandons a PR in this session. Plan/Debug detection is **rule-first** only (no mode hooks in this skill).

Cursor glue is personal (init already gitignores the rule path). Do not commit rules/hooks unless the team opts in; do not gitignore all of `.cursor/`.

Safe to re-run: update the rule; do not duplicate hook entries. Re-run ensure when templates or Cursor task names changed.

## Rule snippet

```markdown
# Clockify time (from .clockify/config.yml entry.automated)

On Clockify MCP calls, pass config_root as the git toplevel (or folder root).
If already known this session and still this repo, reuse it; do not run git
before every tool. Otherwise `git rev-parse --show-toplevel` from the working
directory (open tabs are not required). In a multi-root workspace,
git-toplevel the focused path; re-resolve when focus moves to another root.
Do not pass the .code-workspace parent.

Forge starts: use entry.automated.on_start for description and task. Expand
templates with issue_number, issue_title, label, local_folder. When a template
contains {label} and the issue has multiple labels, honor
on_start.when_multiple_labels (first | prompt). Pass entry_method: automated.
If another timer is running, warn and confirm before stopping it (same as
issue_switch).

When they finish the issue, switch issues (after confirm), ship the PR, or
close or abandon the PR in this session, stop the timer with
entry_method: automated.

Cursor Plan/Debug: pass cursor_mode on clockify_start_timer. Plan start only
when no issue is in context; with an issue in context use issue_start. Build
(leaving Plan) is stop only — do not start a Build timer. Warn before start
when a different timer is running.

Check running timers for inactivity on session resume. Honor overlap.on_conflict.

Use Clockify MCP tools only; never invent project/task ids.
```

## Do not

- Duplicate `clockify-init` steps here when config already exists
- Treat `pr_merged` as valid — GitHub merge is an unwatched action and is not supported
- Install a background daemon
- Skip init when config or ignore defaults are missing
- Prefix client-picker options with numbers (`None` and `Create Client` are enough; AskQuestion adds A/B/C)
- Use AskQuestion for the **new client name** after **Create Client** — chat only
- Write client into `config.yml`
- Offer GitLab/Bitbucket as working forge options (enum stubs only)
