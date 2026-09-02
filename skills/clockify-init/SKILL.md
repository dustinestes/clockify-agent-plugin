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

Set up the repo contract so timer and enter-time tools share one yaml. Config is **personal by default** (gitignored) so product repos stay clean. Decision map: [flows.md](../../docs/flows.md).

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
   - **Do not** re-prompt for `scope.workspace_id` or **shape** when config already exists unless the user asks to change them.
   - Only fill **missing** ignore pieces (step 11), then jump to verify + conditional ensure (steps 13–17).
4. Otherwise continue with first-time bootstrap below.

`.clockify/.managed-by-init` marks layout ownership for `clockify-uninit`; its presence alone is not required to skip — existing `config.yml` is the primary “already inited” signal.

## First-time bootstrap

5. `clockify_list_workspaces` with `config_root` — numbered menu, **AskQuestion**. There is **no** “use active workspace” option. The user must pick a listed workspace. Write that id to `scope.workspace_id`.

   ```text
   Choose the Clockify workspace for this repo:
   1 - Workspace A Name (abc123...)
   2 - Workspace B Name (def456...)
   ```

6. Ask how this repo maps into Clockify (**AskQuestion**) **before** writing final yaml or calling ensure:

   ```text
   Choose how this repo maps into Clockify:
   0 - None (write local config only; do not create/ensure project or tasks yet)
   1 - Repo as project (project = repo folder; GitHub labels → tasks)
   2 - Repo as task (fixed Clockify project; task = repo folder)
   ```

7. If shape **2**: ask for the shared Clockify **project name**. Prefer **AskQuestion** with **only concrete names** (existing Clockify projects in the chosen workspace, and/or a clearly labeled folder-name guess). **Do not add an “Other” option** — AskQuestion already injects one; a second Other is duplicate UX. If they pick the built-in Other, wait for the name in chat (or the “Add more optional details” field). That value is `project.name`. Do not invent a name.

8. Write `.clockify/config.yml`: start from the plugin’s `.clockify/config.yml.example` unless the user specifies different values, then overlay the shape (see [Shape overlays](#shape-overlays)). Always set `scope.workspace_id` from step 5. Default `scope.client.from: none` until the client step.

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
    | **1** Repo as project | `scope.project.from: repo` **and** any method `entry_methods.*.task.from: github_label` | client step, `clockify_ensure_project`, then label → task sync |
    | **2** Repo as task | `scope.project.from: fixed` **and** any method `entry_methods.*.task.from: repo` | client step, `clockify_ensure_project`, then one repo-named task |
    | **0** Local only | otherwise (example: `scope.project.from: repo` with interactive `task.from: prompt` and `entry_methods.automated.task.from: none`) | **Skip** client picker, ensure_project, and all task ensure |

    First-time shape **0**, and re-runs of that yaml, must **not** create a Clockify project or tasks. Do not call `clockify_ensure_project` “just in case.”

14b. **Client pin (shape 1 or 2 only).** Decision map: [docs/flows.md](../../docs/flows.md). After the shape-2 project **name** is known, `clockify_list_projects` (name filter) in the **pinned** workspace — do not create yet.

    - **Only skip AskQuestion** when `scope.client` in yaml **already** matches the Clockify project’s client (`from: fixed` and same `id`). Re-run idempotency only — chat `Client: <name> (unchanged)`.
    - **Always AskQuestion** when yaml is `from: none`, client unset, or the pin disagrees with Clockify — **even if** the existing project already has a client in Clockify. Do **not** copy Clockify’s client into yaml without an explicit pick. Do **not** prefix options with `0 -`, `1 -`, etc. — AskQuestion already letters them A, B, C…

      ```text
      None
      Create Client
      ```

      When `clockify_list_clients` returns names, insert each unarchived client **between** `None` and `Create Client` (label = client name only). If the project already has a `clientId` / `clientName` not in that list, include that client in the menu too. When the list is empty or the call fails, use **only** `None` and `Create Client` — no second skip, no custom Other.

      - **None:** do not create or associate; `scope.client.from: none`.
      - **Listed client name:** new project → `clockify_ensure_project` with `client_id`. Existing project → `clockify_ensure_project` with `client_id` **and** `set_client: true` (explicit pick only).
      - **Create Client:** ask for the name (chat or AskQuestion “Add more optional details”), then `clockify_create_client` and associate. Same as picking the UI’s built-in Other — do **not** add a third authored “create” choice.
      - List-clients **error:** still AskQuestion with `None` + `Create Client`; chat `Client: failed to retrieve clients`; continue ensure.
      - Do **not** PATCH an existing project’s client unless they just picked one.

15. When shape **1** (or yaml matches that row): `clockify_ensure_project` with `config_root` (and `client_id` / `set_client` from 14b). Then sync GitHub labels → Clockify tasks:
    - `gh label list --json name` (or GitHub API)
    - For each label: `clockify_ensure_task` with `config_root`, `project_id` + label `name`
    - If there are no remotes or labels, skip task create and say so — still keep the project if ensure ran.
16. When shape **2** (or yaml matches that row): `clockify_ensure_project` with `config_root` (`fixed` → `scope.project.name`, plus client args from 14b). Then `clockify_ensure_task` once with `config_root`, `project_id`, and `repoName` from get_config.
17. Summarize: first-time vs already present, **shape chosen** (or detected), config path, **ignored by default**, how to opt in. If shape 0: local files only, no Clockify project/tasks. If shape 1/2: project id, tasks created vs existing, **client** (existing name, newly created, none, or retrieve-failed). Mention `clockify-automate` if they want agent-mediated start/stop.

## Shape overlays

Copy `.clockify/config.yml.example`, then set:

**0 — None (local only)** — leave the example as-is: `scope.project.from: repo`; `scope.client.from: none`; timer/manual `task.from: prompt`; **`entry_methods.automated.task.from: none`**. Do not call ensure.

**1 — Repo as project** — `scope.project.from: repo`. For **timer, manual, and automated**:

```yaml
task:
  from: github_label
  if_missing: create
```

Timer and automated `description.from: template` with `template: "{issue_number} - {issue_title}"` (manual stays `prompt`). Then client step + ensure project + label sync.

**2 — Repo as task** — `scope.project.from: fixed` and `scope.project.name` from step 7. For **timer, manual, and automated**:

```yaml
task:
  from: repo
  if_missing: create
```

Same description overlay as shape 1. Then client step + ensure fixed project + repo-named task.

## Do not

- Put API keys in `.clockify/config.yml` (or anywhere under `.clockify/`)
- Invent Clockify ids or copy a project’s existing client into yaml without AskQuestion
- Force-add `.clockify/` to git
- Overwrite an existing `.clockify/config.yml` without an explicit user request
- Enable automated Cursor rules here — that is `clockify-automate`
- Ensure project or tasks before the user answers the shape question
- Add a custom “Other” AskQuestion choice (the UI already provides one)
- Prefix client-picker options with numbers (`None` and `Create Client` are enough; AskQuestion adds A/B/C)

## Default yaml (unless user overrides)

Copy the plugin `.clockify/config.yml.example` as the **local-only (shape 0)** scaffold, then overlay shape 1 or 2 as above. That file has `plugin_internal`, `scope`, and `entry_methods` (`timer` / `manual` / `automated`): required workspace pin, client none, project from repo name, prompt vs template descriptions, nearest-15 rounding on timer and automated, overlap `prompt`, automated triggers, inactivity 45 minutes, **`entry_methods.automated.task.from: none`** so copying it does not imply label→task create.
