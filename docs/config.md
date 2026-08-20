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

## Git hygiene

- **Default:** do not commit `.clockify/`. Init writes a directory self-ignore and a managed stanza in the repo `.gitignore`.
- **Team opt-in:** delete the managed ignore block and commit `.clockify/` on purpose if the team wants shared standards. Still never commit API keys.
- **Cursor glue:** `.cursor/rules/clockify.mdc` is also listed in the managed stanza when automated init is used. Other `.cursor/` files stay team-owned; do not ignore all of `.cursor/`.
- **Cleanup:** run `clockify-unautomate` to drop Cursor glue and keep config, or `clockify-uninit` for full local teardown.
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

Sandbox (`clockify-install-cursor --sandbox`) already sets env `CLOCKIFY_CONFIG_ROOT` on a project MCP pointing at this checkout’s `dist/`. That is a maintainer overlay, not the consumer install.

`CLOCKIFY_CONFIG_PATH` can still point at an explicit yaml file (tests).

---

<br>

---

<strong>Clockify Agent Plugin</strong>
<div align="right">

[MIT License](../LICENSE)

</div>
<br clear="both">
