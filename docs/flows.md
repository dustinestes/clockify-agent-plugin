<br><br>
<img align="right" src="../assets/logo.svg" height="40" alt="Clockify Agent Plugin">
<h1>Flows</h1>
<br clear="both">

Decision maps for skills. Agent procedures stay in each `SKILL.md`; field lists stay in [schema/config.yml.md](./schema/config.yml.md). If a section outgrows this file, split into `docs/flows/` later.

<br>

## Contents

- [Contents](#contents)
- [Product ladder](#product-ladder)
- [clockify-init](#clockify-init)
  - [Why workspace is required](#why-workspace-is-required)
  - [AskQuestion: workspace](#askquestion-workspace)
  - [Data in / out](#data-in--out-init)
- [clockify-automate](#clockify-automate)
  - [Forge wizard](#forge-wizard)
  - [Cursor platforms wizard](#cursor-platforms-wizard)
  - [Project client (Clockify only)](#project-client-clockify-only)
  - [AskQuestion: assign client](#askquestion-assign-client)
  - [on_start resolution](#on_start-resolution)
  - [Data in / out](#data-in--out-automate)

---

<br>

## Product ladder

```mermaid
flowchart TD
  init["clockify-init"]
  baseYaml["v3 base\nforge none, platforms off"]
  manualUse["Timer / enter-time / stop"]
  automate["clockify-automate"]
  forgeWiz["Forge wizard\nGitHub"]
  cursorWiz["Cursor platforms\nplan + debug"]
  patch["Patch entry.automated +\nensure +\nrules"]

  init --> baseYaml --> manualUse
  baseYaml --> automate
  automate --> forgeWiz --> cursorWiz --> patch
```

| Stage | Skill | User gets |
|-------|-------|-----------|
| Base | `/clockify-init` | Workspace pin, prompt descriptions, timer task none, `entry.automated.enabled: false`, `forge: none`, empty triggers, Cursor platforms off |
| Automated | `/clockify-automate` | Forge wizard (GitHub), Cursor Plan/Debug, ensure project/tasks, Cursor rules |

---

<br>

## clockify-init

`/clockify-init` pins **where** time goes (`scope.workspace_id`) and writes the v3 base contract. It does **not** ensure projects/tasks or enable automation. Skill steps: [clockify-init](../skills/clockify-init/SKILL.md).

### Why workspace is required

Clockify’s “active” workspace follows whatever the user last opened in the product UI. A background agent plus someone clicking around Clockify would then `ensure_project` and write entries in the wrong workspace. Init always writes `scope.workspace_id`. MCP tools never fall back to active/default workspace.

### AskQuestion: workspace

- Purpose: pin `scope.workspace_id`.
- Options: listed workspaces only (`clockify_list_workspaces`). **No** option 0 / “use active”.
- Cursor Other is not used for create-workspace (out of scope).

```text
Choose the Clockify workspace for this repo:
1 - Workspace A Name (abc123...)
2 - Workspace B Name (def456...)
```

Then write `.clockify/config.yml` from the plugin example (`plugin` / `scope` / `entry`), set `workspace_id`, leave `entry.automated` off (`forge: none`, empty triggers, Cursor platforms off). Write ignore markers. End: timer and enter-time are ready; run `/clockify-automate` for forge + Cursor automation.

### Data in / out (init)

| Direction | What |
|-----------|------|
| In | `clockify_list_workspaces`, git toplevel / folder name for `local_folder` |
| Out (yaml) | `plugin.version: 3`, `scope.workspace_id`, `scope.project.from: local_folder`, `entry.timer` / `manual` / `automated` base scaffold |
| Out (Clockify) | None — no project/task ensure |

---

<br>

## clockify-automate

Mode on. If config is missing, run init first. Then forge + Cursor wizards, patch yaml, ensure resources, write Cursor rules. Skill: [clockify-automate](../skills/clockify-automate/SKILL.md).

### Forge wizard

Skip when `entry.automated.forge` is already a real forge and `enabled` is true, unless the user asks to reconfigure.

1. **Forge** — AskQuestion. Only **GitHub** is implemented. Set `entry.automated.forge: github`.
2. **Project** — how `scope.project` resolves: `local_folder`, `fixed` (+ name), or `prompt` (ask each time; skip ensure).
3. **on_start description** — `prompt` or `template` (preset `{issue_number} - {issue_title}` or custom).
4. **on_start task** — `template` / `local_folder` / `fixed` / `none` / `prompt`.
5. **when_multiple_labels** — only if a chosen template contains `{label}`: `first` or `prompt`. Default if skipped: `first`.
6. **Client when ensuring** — see below (not stored in yaml).

Then set forge triggers:

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

### Cursor platforms wizard

Ask whether to enable Cursor Plan and Debug mode timers (defaults: **yes** for both). Optionally rename fixed task names (defaults: `agent_planning`, `agent_debug`).

Write under `entry.automated.platforms.cursor`:

- `enabled: true` when either mode is on
- Per enabled mode: `triggers` start/stop, `description.from: prompt`, `task.from: fixed` + chosen name, `if_missing: create`

If both declined: `platforms.cursor.enabled: false`, `modes: {}`.

Plan/Debug detection is **rule-first** (`.cursor/rules/clockify.mdc`). Hook-based mode detection is out of scope here — follow-up [issue #85](https://github.com/dustinestes/clockify-agent-plugin/issues/85).

### Project client (Clockify only)

Clients live on the Clockify **project**, not in `config.yml`. After the project name is known (`local_folder` folder name, or `scope.project.name` for fixed; skip when `from` is `prompt`):

- **Project found with client:** skip AskQuestion; report `Client: <name> (already set on project)`. Do not change it.
- **Project missing or no client:** AskQuestion assign client (below), then ensure / set client.

```mermaid
flowchart TD
  lookup[List project by name]
  hasClient{Project exists with client?}
  report[Report client in chat]
  ask[AskQuestion assign client]
  create[Create project with optional clientId]
  patch[clockify_set_project_client PUT]
  tasks[ensure forge + Cursor tasks]

  lookup --> hasClient
  hasClient -->|yes| report
  hasClient -->|no| ask
  ask -->|new project| create
  ask -->|existing no client| patch
  report --> tasks
  create --> tasks
  patch --> tasks
```

### AskQuestion: assign client

- **Prerequisite:** `clockify_list_clients` in the pinned workspace — build options from the response; do not open AskQuestion until this returns (or fails).
- Purpose: optionally assign a client on a **new** project or an existing project that has none.
- No `N -` prefixes (AskQuestion letters options A, B, C…).
- Authored options: `None`, then **each** unarchived client name from `list_clients`, then `Create Client`. Empty list or list error: **only** `None` and `Create Client`.
- **Create Client** → ask the name in **chat** (not AskQuestion); then `clockify_create_client`.
- List error: still use `None` + `Create Client`; chat `Client: failed to retrieve clients`.
- Never PATCH a project that already has a client. Never write client into `config.yml`.

### on_start resolution

Forge starts honor `entry.automated.on_start`. Expand templates with `{issue_number}`, `{issue_title}`, `{label}`, `{local_folder}`.

```mermaid
flowchart TD
  start[Forge start_timer]
  desc{description.from}
  task{task.from}
  multi{template has label and 2+ labels?}
  first[Use first label]
  askLabel[AskQuestion which label]
  resolve[Resolve description + task]
  mcp[clockify_start_timer entry_method automated]

  start --> desc
  desc -->|prompt| task
  desc -->|template| multi
  multi -->|no| task
  multi -->|when_multiple_labels first| first --> task
  multi -->|when_multiple_labels prompt| askLabel --> task
  task --> resolve --> mcp
```

When `cursor_mode` is set, the matching `platforms.cursor.modes.<mode>` block overrides this forge `on_start` path.

### Data in / out (automate)

| Direction | What |
|-----------|------|
| In | Existing config (or init first), `clockify_list_projects`, `clockify_list_clients`, optional `gh label list`, folder name |
| Out (yaml) | `entry.automated.enabled: true`, `forge`, `on_start`, forge `triggers`, `platforms.cursor`; may patch `scope.project` |
| Out (Clockify) | `ensure_project` / `set_project_client` / `create_client` as needed; `ensure_task` for `{label}` labels, `local_folder`/`fixed` on_start tasks, Cursor fixed task names |
| Out (Cursor) | `.cursor/rules/clockify.mdc` from declared triggers + platforms |

---

<br>

---

<strong>Clockify Agent Plugin</strong>
<div align="right">

[MIT License](../LICENSE)

</div>
<br clear="both">
