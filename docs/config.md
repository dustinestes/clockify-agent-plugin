<br><br>
<img align="right" src="../assets/logo.svg" height="40" alt="Clockify Agent Plugin">
<h1>Config</h1>
<br clear="both">

How `.clockify/config.yml` gets on disk, how git treats it, and how the server finds it. 

- Field contract: [schema/config.yml.md](./schema/config.yml.md)
- Config missing while the file exists: [troubleshoot.md](./troubleshoot.md#clockifyconfigyml-not-found).

<br>

## Contents

- [Contents](#contents)
- [Setup](#setup)
- [Shape](#shape)
  - [Repo as project](#repo-as-project)
    - [Configuration](#configuration)
    - [How to use](#how-to-use)
  - [Repo as task](#repo-as-task)
    - [Configuration](#configuration-1)
    - [How to use](#how-to-use-1)
- [Git hygiene](#git-hygiene)
- [Discovery](#discovery)
- [Which repo (`config_root`)](#which-repo-config_root)
- [When to reuse `config_root`](#when-to-reuse-config_root)
- [Optional project MCP overlay](#optional-project-mcp-overlay)

---

<br>

## Setup

The API key lives in **user** MCP (`~/.cursor/mcp.json`). Each git repo keeps its own `.clockify/config.yml` (workspace, project, rounding, templates, triggers). Do not put API keys in the yaml.

Preferred: `/clockify-init` in the repo (writes config, ignore defaults, Clockify project). Or copy by hand:

```bash
mkdir -p .clockify
cp path/to/clockify-agent-plugin/.clockify/config.yml.example .clockify/config.yml
```

Skills pass `config_root` on Clockify tool calls so a user-scoped MCP process can find this file. Resolve it once, then reuse — [When to reuse `config_root`](#when-to-reuse-config_root). How to pick the path: [Which repo (`config_root`)](#which-repo-config_root).

---

<br>

## Shape

These shapes are how you line up git/GitHub with Clockify’s tree (workspace → project → task → description) taxonomy, not extra timer modes. Pick the shape that matches how you want to track and report; then encode it in `.clockify/config.yml`.

**Workspace:** this plugin does not define a workspace by shape. You choose this when running `/clockify-init` (personal, team, client space).

**Clients:** this plugin does not set Clockify clients (they are optional on a project). Assign one in Clockify: **Projects** → **Select Project** → **Settings** → **Client** dropdown.

### Repo as project

Granular 1:1. The Clockify project name **is** the git repo name. GitHub labels become tasks so you can report time on work labeled as features, bugs, docs, and so on inside that repo. This is what `/clockify-init` and the README default story describe.

Example: workspace *Acme Labs*, client *Northwind*, project = repo name, task = GitHub label.

- Workspace → user defined
- Project → repo name
- Task → GitHub label
- Description → `{issue_number} - {issue_title}`

#### Configuration

```yaml
project:
  from: repo

timer:
  description:
    from: template
    template: "{issue_number} - {issue_title}"
  task:
    from: github_label
    if_missing: create

manual:
  description:
    from: template
    template: "{issue_number} - {issue_title}"
  task:
    from: github_label
    if_missing: create

automated:
  description:
    from: template
    template: "{issue_number} - {issue_title}"
  task:
    from: github_label
    if_missing: create
```

#### How to use

1. In the repo, run `/clockify-init`; pick a Clockify workspace; leave `project.from: repo`.
2. Init creates/finds a Clockify project named like the repo folder and can sync GitHub labels → tasks when `task.from` is `github_label`.
3. Start/stop timers or automate as usual; descriptions and tasks follow the yaml.

### Repo as task

Compact. For when you do not need label-level granularity. Many sibling repos report under one fixed Clockify project (a milestone or initiative). Each repo is a **task** under that project.

Example: workspace *Acme Labs*, client *Northwind*, project *Application modernization*, tasks = repo name (i.e. `webapp`, `mobileapp`, `database`, `website`).

- Workspace → user defined
- Project → fixed name (`project.from: fixed`)
- Task → repo name
- Description → issue fields; add `{repo}` only if you still want the name in the text

#### Configuration

```yaml
project:
  from: fixed
  name: Application modernization

timer:
  description:
    from: template
    template: "{issue_number} - {issue_title}"
  task:
    from: repo
    if_missing: create

manual:
  description:
    from: template
    template: "{issue_number} - {issue_title}"
  task:
    from: repo
    if_missing: create

automated:
  description:
    from: template
    template: "{issue_number} - {issue_title}"
  task:
    from: repo
    if_missing: create
```

#### How to use

1. Run `/clockify-init`; pick a Clockify workspace.
2. Set `project.from: fixed` and `project.name` to the shared Clockify project.
3. Init (or timer/enter-time skills) uses `repoName` from `clockify_get_config` — the git toplevel folder name — as the Clockify task (`ensure_task` when `if_missing` is `create`).

---

<br>

## Git hygiene

- **Default:** do not commit `.clockify/`. Init writes a directory self-ignore and a managed stanza in the repo `.gitignore`.
- **Team opt-in:** delete the managed ignore block and commit `.clockify/` on purpose if the team wants shared standards. Still never commit API keys.
- **Cursor glue:** `.cursor/rules/clockify.mdc` is also listed in the managed stanza when automated init is used. Other `.cursor/` files stay team-owned; do not ignore all of `.cursor/`.
- **Cleanup:** run `clockify-unautomate` to drop Cursor glue and keep config, or `clockify-uninit` for full local teardown. Uninit removes the managed gitignore stanza; if `.gitignore` is then empty (or whitespace-only), it deletes the file. A non-empty `.gitignore` is never deleted.
- A global `core.excludesfile` can ignore Clockify files in every repo; it is an extra option, not a substitute for init’s repo-local default.

---

<br>

## Discovery

The MCP server looks for yaml in this order:

1. `CLOCKIFY_CONFIG_PATH` (explicit file; tests / sandbox). A leftover value in **user** MCP env still wins over everything below.
2. Tool argument `config_root` if provided — treated as the project root; load `.clockify/config.yml` under it (no walk).
3. Env `CLOCKIFY_CONFIG_ROOT` (sandbox / optional [project MCP overlay](#optional-project-mcp-overlay)).
4. Walk up from `process.cwd()` (last resort; user-scoped MCP cwd is usually not the open git repo).

Project root is the git repo root (parent of `.clockify/`), not the `.clockify` directory itself.

---

<br>

## Which repo (`config_root`)

`config_root` is a **directory**, not an open tab. Empty editors and Agent chat with no files open still work. Callers (skills, rules, other hosts) should resolve it in this order:

1. `git rev-parse --show-toplevel` from the **agent/shell working directory** (no path argument).
2. If that fails, the same command from the **folder this Cursor window opened** (single-folder window).
3. Only if those are ambiguous (multi-root `.code-workspace`): git-toplevel the focused file or explorer folder.
4. If still ambiguous: ask which root, or look for `.clockify/config.yml` under each root. Do not guess the `.code-workspace` parent.

| Situation | What to use as `config_root` |
|-----------|------------------------------|
| Single-folder window, files open or not | Git toplevel of that folder (usually the same as cwd) |
| Several Cursor windows | Git toplevel of **this** window’s folder |
| Multi-root, a file or folder focused | Git toplevel of that path |
| Multi-root, nothing focused | Ask, or scan roots for `.clockify/config.yml` — do not guess the `.code-workspace` parent |
| CLI in one clone | Git toplevel of that checkout’s cwd — same command, no editor |

---

<br>

## When to reuse `config_root`

`git rev-parse --show-toplevel` is cheap. Running a Shell tool to learn the path on every MCP call is not. Resolve once, pass the same string on later Clockify tools. Do **not** cache this in the MCP server (one user-scoped process serves every window).

| Scope | Reuse `config_root`? |
|-------|----------------------|
| Several MCP calls in one skill (`get_config` then `start_timer`) | Yes — resolve once, pass the string |
| Same chat, same single-folder window | Yes — reuse unless cwd looks wrong |
| User switches folders / another window | Re-resolve |
| Multi-root, focus moved to another root | Re-resolve (git toplevel of the new path) |
| MCP process memory | No |

Never pass `${workspaceFolder}` from **user** `mcp.json` — that folder is `~/.cursor`, not the git repo.

Clockify still allows only **one running timer** across all roots. Switching repos should warn like `issue_switch`.

Cursor Agents window / cloud agents are not supported in this release (same git-toplevel rule would apply if that host exposes these tools later).

---

<br>

## Optional project MCP overlay

Consumer install stays **user** MCP (API key only). Do not set `CLOCKIFY_CONFIG_ROOT` in `~/.cursor/mcp.json`.

If you want process-level pinning in **one** repo, a project `.cursor/mcp.json` can set `CLOCKIFY_CONFIG_ROOT` to `${workspaceFolder}` (that interpolation is the folder that contains the project `mcp.json`). Project MCP of the same server name **replaces** the user server, so you must still supply the API key (or `${env:CLOCKIFY_API_KEY}`). Project MCP can be flaky in multi-root windows; `config_root` on each tool call is the supported path.

Sandbox (`clockify-install-cursor --sandbox`) writes project MCP as **`clockify-agent-plugin-sandbox`** pointing at this checkout’s `dist/`, with `CLOCKIFY_CONFIG_ROOT` set to the temp sandbox. That is a maintainer overlay, not the consumer install.

`CLOCKIFY_CONFIG_PATH` can still point at an explicit yaml file (tests).

---

<br>

---

<strong>Clockify Agent Plugin</strong>
<div align="right">

[MIT License](../LICENSE)

</div>
<br clear="both">
