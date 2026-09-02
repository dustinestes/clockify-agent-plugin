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

8. Write `.clockify/config.yml`: start from the plugin’s `.clockify/config.yml.example` unless the user specifies different values, then overlay the shape (see [Shape overlays](#shape-overlays)). Always set `scope.workspace_id` from step 5. Do **not** store a client in yaml — clients live on the Clockify project only.

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

14b. **Project client (shape 1 or 2 only).** Clients are set on the Clockify **project**, not in `config.yml` — time entries target projects and tasks only. Decision map: [docs/flows.md](../../docs/flows.md).

    After the Clockify **project name** is known (repo folder for shape 1; `scope.project.name` for shape 2), `clockify_list_projects` (name filter) in the **pinned** workspace — do not create yet.

    - **Project found with `clientId` / `clientName`:** skip AskQuestion. Chat `Client: <name> (already set on project)`. Do **not** offer to change or reassign — that is the Clockify UI or a separate process.
    - **Project missing, or found without a client:**

      1. **Always** call `clockify_list_clients` with `config_root` **before** AskQuestion (same pinned workspace).
      2. Build AskQuestion from the result (no `0 -`, `1 -`, … prefixes — AskQuestion letters A, B, C…):

      ```text
      None
      Kevin
      Daniel
      Create Client
      ```

      Use each unarchived client **name** from step 1 between `None` and `Create Client` (label = name only — no ids in the label). Example above is for two clients named Kevin and Daniel. **Only** when the list is empty or the call fails: `None` and `Create Client` only.

      - **None:** ensure the project without a client.
      - **Listed client name:** new project → `clockify_ensure_project` with `client_id`. Existing project without client → `clockify_set_project_client` with `project_id` and `client_id` (not `set_client` on ensure).
      - **Create Client:** **only after** they pick this option — ask in **chat** for the new name (not AskQuestion). Then `clockify_create_client` and associate via `client_id` on create or `clockify_set_project_client` on existing. The chat-only rule does **not** apply to the main picker above; existing clients **must** appear there when `list_clients` returns them.
      - List-clients **error:** still AskQuestion with `None` + `Create Client`; chat `Client: failed to retrieve clients`; continue ensure.
      - Do **not** write client into `config.yml`. Do **not** PATCH a project that already has a client.

15. When shape **1** (or yaml matches that row): `clockify_ensure_project` with `config_root` (and `client_id` from 14b when creating a new project). Then sync GitHub labels → Clockify tasks:
    - `gh label list --json name` (or GitHub API)
    - For each label: `clockify_ensure_task` with `config_root`, `project_id` + label `name`
    - If there are no remotes or labels, skip task create and say so — still keep the project if ensure ran.
16. When shape **2** (or yaml matches that row): `clockify_ensure_project` with `config_root` (`fixed` → `scope.project.name`, plus `client_id` from 14b when creating a new project). Then `clockify_ensure_task` once with `config_root`, `project_id`, and `repoName` from get_config.
17. Summarize: first-time vs already present, **shape chosen** (or detected), config path, **ignored by default**, how to opt in. If shape 0: local files only, no Clockify project/tasks. If shape 1/2: project id, tasks created vs existing, **client on the Clockify project** (already set, newly assigned, none, or retrieve-failed). Mention `clockify-automate` if they want agent-mediated start/stop.

## Shape overlays

Copy `.clockify/config.yml.example`, then set:

**0 — None (local only)** — leave the example as-is: `scope.project.from: repo`; timer/manual `task.from: prompt`; **`entry_methods.automated.task.from: none`**. Do not call ensure.

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
- Store or write `scope.client` in yaml — clients are Clockify project metadata only
- Change a Clockify project’s client during init when one is already set
- Force-add `.clockify/` to git
- Overwrite an existing `.clockify/config.yml` without an explicit user request
- Enable automated Cursor rules here — that is `clockify-automate`
- Ensure project or tasks before the user answers the shape question
- Add a custom “Other” AskQuestion choice (the UI already provides one)
- Prefix client-picker options with numbers (`None` and `Create Client` are enough; AskQuestion adds A/B/C)
- Use AskQuestion for the **new client name** after **Create Client** — chat only; no second picker (the main picker **must** still list clients from `clockify_list_clients`)

## Default yaml (unless user overrides)

Copy the plugin `.clockify/config.yml.example` as the **local-only (shape 0)** scaffold, then overlay shape 1 or 2 as above. That file has `plugin_internal`, `scope`, and `entry_methods` (`timer` / `manual` / `automated`): required workspace pin, project from repo name, prompt vs template descriptions, nearest-15 rounding on timer and automated, overlap `prompt`, automated triggers, inactivity 45 minutes, **`entry_methods.automated.task.from: none`** so copying it does not imply label→task create.
