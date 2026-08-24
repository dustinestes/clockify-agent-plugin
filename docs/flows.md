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
  yamlMatch{Yaml client already matches Clockify?}
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
  yamlMatch -->|yes or yaml empty| write
  yamlMatch -->|yaml pin differs| ask
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
- Existing Clockify project already has a client **and** yaml is unset or already that client: skip picker; copy Clockify’s client into yaml. Chat: `Client: Northwind (existing)`.
- No project, project has no client, or yaml pin disagrees: ask. Never silently PATCH an existing project’s client.

### AskQuestion: client

- Purpose: optional client on the Clockify project + `scope.client`.
- Authored options: **only** `0 - None`, then unarchived clients `1…N`. Cursor **Other** creates (`clockify_create_client`). Do not add another skip/none (that shows up as B).
- Empty list or list error: skip AskQuestion (it requires two options and a dummy B duplicates none). Chat: none, or type a name to create. On list error also say `Client: failed to retrieve clients`.

### Data in / out

| Direction | What |
|-----------|------|
| In | `clockify_list_workspaces`, `clockify_list_projects`, `clockify_list_clients` (active only), git toplevel folder name, optional GitHub labels (shape 1) |
| Out (yaml `scope`) | `workspace_id` (required), `project` (`from` + optional `name`), `client` (`from: none` or `fixed` + `id` / `name`) |
| Out (Clockify) | `clockify_create_client` on Other; `clockify_ensure_project` with `client_id` on create; `set_client: true` only after an explicit pick on an existing project; `clockify_ensure_task` per shape |

---

<br>

---

<strong>Clockify Agent Plugin</strong>
<div align="right">

[MIT License](../LICENSE)

</div>
<br clear="both">
