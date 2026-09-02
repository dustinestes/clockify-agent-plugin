<br><br>
<img align="right" src="../assets/logo.svg" height="40" alt="Clockify Agent Plugin">
<h1>Flows</h1>
<br clear="both">

Decision maps for skills. Agent procedures stay in each `SKILL.md`; field lists stay in [schema/config.yml.md](./schema/config.yml.md). If a section outgrows this file, split into `docs/flows/` later.

<br>

## Contents

- [Contents](#contents)
- [clockify-init](#clockify-init)
  - [Why workspace is required](#why-workspace-is-required)
  - [AskQuestion: workspace](#askquestion-workspace)
  - [AskQuestion: shape](#askquestion-shape)
  - [AskQuestion: project name (shape 2)](#askquestion-project-name-shape-2)
  - [Client skip vs ask](#client-skip-vs-ask)
  - [AskQuestion: client](#askquestion-client)
  - [Data in / out](#data-in--out)

---

<br>

## clockify-init

`/clockify-init` pins **where** time goes (`scope`) before it writes method blocks. Skill steps: [clockify-init](../skills/clockify-init/SKILL.md).

```mermaid
flowchart TD
  skip0[Shape 0: skip client entirely]
  lookup[List project by name]
  hasProj{Project exists?}
  hasClient{Clockify client already set?}
  yamlMatch{Yaml client id matches Clockify?}
  ask[AskQuestion clients]
  create[Create project with optional clientId]
  patch[PATCH project client only after an explicit pick]
  write[Write client block into config.yml]

  skip0 --> write
  lookup --> hasProj
  hasProj -->|no| ask
  ask --> create
  create --> write
  hasProj -->|yes| hasClient
  hasClient -->|yes| yamlMatch
  yamlMatch -->|yes| write
  yamlMatch -->|no| ask
  hasClient -->|no| ask
  ask --> patch
  patch --> write
```

### Why workspace is required

Clockify’s “active” workspace follows whatever the user last opened in the product UI. A background agent plus someone clicking around Clockify would then `ensure_project` and write entries in the wrong workspace. Init always writes `scope.workspace_id`. MCP tools never fall back to active/default workspace.

### AskQuestion: workspace

- Purpose: pin `scope.workspace_id`.
- Options: listed workspaces only (`clockify_list_workspaces`). **No** option 0 / “use active”.
- Cursor Other is not used for create-workspace (out of scope).

### AskQuestion: shape

- Purpose: choose taxonomy 0 / 1 / 2 before any Clockify create.
- Options: `0 - None`, `1 - Repo as project`, `2 - Repo as task`.

### AskQuestion: project name (shape 2)

- Purpose: `scope.project.name` when `from: fixed`.
- Options: existing project names in the pinned workspace (plus a labeled folder guess if useful). Do not add a custom Other.

### Client skip vs ask

- Shape 0: skip. `scope.client.from: none`.
- **Skip AskQuestion** only when yaml `scope.client` already matches the Clockify project’s client (same id). Re-run idempotency.
- **Always ask** when yaml is `from: none` or disagrees — even if Clockify already has a client on the project. Never auto-copy that client into yaml.
- Never silently PATCH an existing project’s client; only after an explicit pick.

### AskQuestion: client

- Purpose: optional client on the Clockify project + `scope.client`.
- No `N -` prefixes (AskQuestion letters options A, B, C…). Follow-up: drop numeric prefixes on workspace/shape prompts too.
- Authored options: `None`, then each unarchived client name (if any), then `Create Client`. Empty list or list error: **only** `None` and `Create Client`.
- **Create Client** → ask the name in **chat** (not AskQuestion); then `clockify_create_client`. Do not offer existing clients or project name as choices for the new name.
- List error: still use `None` + `Create Client`; chat `Client: failed to retrieve clients`.

### Data in / out

| Direction | What |
|-----------|------|
| In | `clockify_list_workspaces`, `clockify_list_projects`, `clockify_list_clients` (active only), git toplevel folder name, optional GitHub labels (shape 1) |
| Out (yaml `scope`) | `workspace_id` (required), `project` (`from` + optional `name`), `client` (`from: none` or `fixed` + `id` / `name`) |
| Out (Clockify) | `clockify_create_client` on Create Client; `clockify_ensure_project` with `client_id` on create; `set_client: true` only after an explicit pick on an existing project; `clockify_ensure_task` per shape |

---

<br>

---

<strong>Clockify Agent Plugin</strong>
<div align="right">

[MIT License](../LICENSE)

</div>
<br clear="both">
