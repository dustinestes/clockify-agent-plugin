---
name: clockify-init
description: >-
  Bootstrap Clockify for a repo: AskQuestion for workspace only, write v3
  .clockify/config.yml from the plugin example (plugin / scope / entry), and
  default-ignore personal time-tracking files. Use when setting up time
  tracking (timer or enter-time). Safe to re-run: does not overwrite existing
  config unless the user asks. Does not enable agent automation — that is
  clockify-automate.
disable-model-invocation: true
---

# Clockify init

Pin a workspace and write the v3 base contract so timer and enter-time share one yaml. Config is **personal by default** (gitignored). Decision map: [flows.md](../../docs/flows.md).

Next mode: [`clockify-automate`](../clockify-automate/SKILL.md) runs the forge + Cursor platforms wizards and writes rules. Do not write those here.

## Config root

Pass `config_root` (absolute git toplevel, or folder root when not a git repo) on Clockify MCP calls. If it is already known this session and still this repo, **reuse it** — do not run git before every tool. Otherwise resolve once:

1. `git rev-parse --show-toplevel` from the working directory (no path argument). Open editor tabs are not required.
2. If that fails, the same command from the folder this Cursor window opened.
3. Multi-root `.code-workspace` only: git-toplevel the focused file or explorer folder.
4. Still ambiguous: ask which root, or look for `.clockify/config.yml` under each root. Do not guess the `.code-workspace` parent.
5. **Non-git:** if `git rev-parse` fails, use the folder this Cursor window opened (or the focused folder in a multi-root workspace) as `config_root`. Do **not** block init — folder name is the `local_folder` fallback.

Re-resolve when the user switches folders or the focused root changes.

## Idempotency

Re-runs are expected (including from `clockify-automate`). Treat existing setup as authoritative:

1. Confirm MCP auth: `clockify_get_user` with `config_root` (fix if missing API key).
2. Detect local folder name from that git toplevel (folder name), or the non-git folder name from step 5 above. Do not use Cursor’s workspace folder when it is a multi-root `.code-workspace` parent.
3. If `.clockify/config.yml` exists (or `clockify_get_config` with `config_root` returns `found: true` at that path):
   - **Do not** rewrite config, `.managed-by-init`, or `.clockify/.gitignore` unless the user explicitly asks to reset/overwrite.
   - **Do not** re-prompt for `scope.workspace_id` when config already exists unless the user asks to change it.
   - Only fill **missing** ignore pieces (Always step), then jump to verify + end message.
4. Otherwise continue with first-time bootstrap below.

`.clockify/.managed-by-init` marks layout ownership for `clockify-uninit`; its presence alone is not required to skip — existing `config.yml` is the primary “already inited” signal.

## First-time bootstrap

1. `clockify_list_workspaces` with `config_root` — numbered menu, **AskQuestion**. There is **no** “use active workspace” option. The user must pick a listed workspace. Write that id to `scope.workspace_id`.

   ```text
   Choose the Clockify workspace for this repo:
   1 - Workspace A Name (abc123...)
   2 - Workspace B Name (def456...)
   ```

2. Write `.clockify/config.yml`: copy the plugin’s `.clockify/config.yml.example` as the base scaffold, then set `scope.workspace_id` from step 1. Leave everything else as in the example (`plugin.version: 3`, `scope.project.from: local_folder`, `entry.timer` / `entry.manual` prompt defaults, `entry.automated.enabled: false`, `forge: none`, empty `triggers`, Cursor platforms off). Do **not** store a client in yaml — clients live on the Clockify project only (set later by automate when ensuring).

3. Write `.clockify/.managed-by-init` (empty marker).
4. Write `.clockify/.gitignore` with a single line: `*` (directory self-ignore so even `git add .` skips personal files).

## Always (first-time and re-run)

1. Ensure repo `.gitignore` has this managed block if missing (idempotent — skip when the comment or `.clockify/` entry already exists; do **not** rewrite the whole file). In a non-git folder, skip this step if there is no `.gitignore` to edit (still write under `.clockify/`).

   ```gitignore
   # Clockify Agent Plugin — personal time-tracking (delete this block to share with the team)
   .clockify/
   .cursor/rules/clockify.mdc
   ```

2. If `.clockify/` is **already tracked** in git, warn and ask before `git rm --cached`; never force-add `.clockify/` to the index.
3. `clockify_get_config` with `config_root` — confirm `found: true`, path under `.clockify/config.yml`, and local folder name. If `found: false`, the file is actually missing (user-scoped MCP cwd is not the repo).
4. Summarize: first-time vs already present, config path, **ignored by default**, how to opt in. End with: timer and enter-time are ready; run `/clockify-automate` for forge + Cursor automation.

## Do not

- Put API keys in `.clockify/config.yml` (or anywhere under `.clockify/`)
- Store or write `scope.client` in yaml — clients are Clockify project metadata only
- Force-add `.clockify/` to git
- Overwrite an existing `.clockify/config.yml` without an explicit user request
- Enable automated Cursor rules here — that is `clockify-automate`
- Ask for taxonomy shape (0/1/2), client, project ensure, or label sync — those belong to `clockify-automate`
- Block init when the folder is not a git repo — use folder-name fallback for `local_folder`
- Add a custom “Other” AskQuestion choice (the UI already provides one)

## Default yaml (unless user overrides)

Copy the plugin `.clockify/config.yml.example` as the base scaffold. Roots are `plugin`, `scope`, and `entry` (`timer` / `manual` / `automated`): required workspace pin, project from `local_folder`, prompt descriptions/tasks for timer and manual, `entry.automated.enabled: false` with `forge: none`, empty triggers, inactivity 45 minutes, Cursor platforms off.
