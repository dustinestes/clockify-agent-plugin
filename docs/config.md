<br><br>
<img align="right" src="../assets/logo.svg" height="40" alt="Clockify Agent Plugin">
<h1>Config</h1>
<br clear="both">

How `.clockify/config.yml` gets on disk, how git treats it, and how the server finds it.

- Field contract: [schema/config.yml.md](./schema/config.yml.md)
- Init vs automate decision maps: [flows.md](./flows.md)
- Config missing while the file exists: [troubleshoot.md](./troubleshoot.md#clockifyconfigyml-not-found).

<br>

## Contents

- [Contents](#contents)
- [Setup](#setup)
- [Init vs Automate](#init-vs-automate)
  - [Base (`/clockify-init`)](#base-clockify-init)
  - [Automated (`/clockify-automate`)](#automated-clockify-automate)
  - [Common automate outcomes](#common-automate-outcomes)
- [Git hygiene](#git-hygiene)
- [Discovery](#discovery)
- [Which repo (`config_root`)](#which-repo-config_root)
- [When to reuse `config_root`](#when-to-reuse-config_root)
- [Optional project MCP overlay](#optional-project-mcp-overlay)

---

<br>

## Setup

The API key lives in **user** MCP (`~/.cursor/mcp.json`). Each git repo keeps its own `.clockify/config.yml` (workspace, project, rounding, templates, triggers). Do not put API keys in the yaml.

Root keys are `plugin` (version **3**), `scope`, and `entry` (`timer` / `manual` / `automated`). Preferred: `/clockify-init` in the repo (workspace picker + ignore defaults). Decision map: [flows.md](./flows.md). Or copy by hand:

```bash
mkdir -p .clockify
cp path/to/clockify-agent-plugin/.clockify/config.yml.example .clockify/config.yml
```

Skills pass `config_root` on Clockify tool calls so a user-scoped MCP process can find this file. Resolve it once, then reuse — [When to reuse `config_root`](#when-to-reuse-config_root). How to pick the path: [Which repo (`config_root`)](#which-repo-config_root).

---

<br>

## Init vs Automate

Two stages. Init writes a usable base yaml for timer and enter-time. Automate turns on agent-mediated forge + Cursor Plan/Debug tracking.

| Stage | Skill | What you get |
|-------|-------|----------------|
| Base | `/clockify-init` | Workspace pin, prompt descriptions, timer task none, `entry.automated.enabled: false`, `forge: none`, empty triggers, Cursor platforms off |
| Automated | `/clockify-automate` | Forge wizard (GitHub), Cursor Plan/Debug platforms, ensure project/tasks, Cursor rules |
| Pause | `/clockify-automate-disable` / `enable` | Temporary off/on without wiping forge / triggers / modes |

**Workspace:** required pin (`scope.workspace_id`) chosen at `/clockify-init`. The plugin does **not** follow Clockify’s UI active workspace.

**Clients:** optional Clockify project metadata, not stored in yaml. Assigned during `/clockify-automate` when ensuring a project (never written to `config.yml`).

**Pause vs rollback:** disable keeps automate-owned settings and removes Cursor glue; unautomate resets `entry.automated` to example defaults. Details: [schema — Automated](./schema/config.yml.md#automated-entryautomated).

### Base (`/clockify-init`)

Pins the workspace and writes v3 yaml from [`.clockify/config.yml.example`](../.clockify/config.yml.example):

- `plugin.version: 3`
- `scope.project.from: local_folder`
- `entry.timer` — description `from: prompt`; task `from: none` (start without blocking on a task name)
- `entry.manual` — description and task `from: prompt`
- `entry.automated.enabled: false`, `forge: none`, empty `triggers`, runaway ceiling 45 minutes, `platforms.cursor` off

Does **not** create Clockify projects or tasks. Timer and enter-time work after init; run `/clockify-automate` when you want agent automation.

### Automated (`/clockify-automate`)

If config is missing, runs init first. Then:

1. **Forge wizard** — GitHub (`entry.automated.forge: github`), how `scope.project` resolves, `on_start` description/task (and `when_multiple_labels` when `{label}` is used), optional client on ensure
2. **Cursor platforms wizard** — Plan/Debug mode timers (`platforms.cursor.modes.plan` / `debug`)
3. **Runaway wizard** — enable + `stop_after_minutes` (suggested default 45)
4. Patches `entry.automated` (enabled, forge triggers, platforms, runaway), ensures project/tasks, writes `.cursor/rules/clockify.mdc`, and when runaway is enabled installs Clockify-owned runaway hooks (`.cursor/hooks/clockify-runaway.sh`)

Plan/Debug detection is **rule-first** (the Cursor rule tells the agent when to start/stop). Work outside configured automate scenarios is timer / enter-time. Runaway hooks are **required** when the runaway wizard enables them (not optional).

### Common automate outcomes

These are what you get after automate — not separate init pickers.

**Folder as project, label as task** — project name = git toplevel / folder name; forge labels become Clockify tasks via `on_start.task` template `{label}`:

```yaml
scope:
  workspace_id: "..."
  project:
    from: local_folder

entry:
  automated:
    enabled: true
    forge: github
    on_start:
      when_multiple_labels: first
      description:
        from: template
        template: "{issue_number} - {issue_title}"
      task:
        from: template
        template: "{label}"
        if_missing: create
```

**Fixed project, folder as task** — many sibling repos under one Clockify project; each repo is a task:

```yaml
scope:
  workspace_id: "..."
  project:
    from: fixed
    name: Application modernization

entry:
  automated:
    enabled: true
    forge: github
    on_start:
      when_multiple_labels: first
      description:
        from: template
        template: "{issue_number} - {issue_title}"
      task:
        from: local_folder
        if_missing: create
```

Full field list: [schema/config.yml.md](./schema/config.yml.md). Wizard maps: [flows.md](./flows.md).

---

<br>

## Git hygiene

- **Default:** do not commit `.clockify/`. Init writes a directory self-ignore and a managed stanza in the repo `.gitignore`.
- **Team opt-in:** delete the managed ignore block and commit `.clockify/` on purpose if the team wants shared standards. Still never commit API keys.
- **Cursor glue:** `.cursor/rules/clockify.mdc` is listed in the managed stanza when automate writes rules; `.cursor/hooks/clockify-runaway.sh` is listed when runaway hooks are installed. Do **not** ignore `.cursor/hooks.json` (shared) or all of `.cursor/`.
- **Cleanup:** run `clockify-automate-disable` to pause (keep forge/triggers/modes; remove Cursor glue). Run `clockify-unautomate` to drop Cursor glue and **reset** `entry.automated` to example defaults (full rollback). Or `clockify-uninit` for full local teardown. Uninit removes the managed gitignore stanza; if `.gitignore` is then empty (or whitespace-only), it deletes the file. A non-empty `.gitignore` is never deleted.
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

Sandbox (`clockify-install-cursor --sandbox`) writes project MCP as **`clockify-agent-plugin-sandbox`** pointing at this checkout’s `dist/`, with `CLOCKIFY_CONFIG_ROOT` set to the temp sandbox and `CLOCKIFY_MCP_SANDBOX=1` so teardown can reap leftover Node. `--sandbox` tears down any existing sandbox first, then creates. That is a maintainer overlay, not the consumer install.

`CLOCKIFY_CONFIG_PATH` can still point at an explicit yaml file (tests).

---

<br>

---

<strong>Clockify Agent Plugin</strong>
<div align="right">

[MIT License](../LICENSE)

</div>
<br clear="both">
