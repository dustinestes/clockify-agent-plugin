<br><br>
<img align="right" src="../assets/logo.svg" height="40" alt="Clockify MCP (unofficial)">
<h1>Config</h1>
<br clear="both">

Per-repo standards via `.clockify/config.yml`: taxonomy, description formatting, rounding, and AI automation triggers. API keys stay in MCP env / plugin variables - not in this file.

Clockify files are **local/personal by default**. Init gitignores `.clockify/` so time-tracking habits do not land in product repos unless the team opts in.

<br>

## Contents

- [Contents](#contents)
- [Setup](#setup)
- [Git hygiene](#git-hygiene)
- [Discovery](#discovery)
- [Schema](#schema)
- [Tools that honor config](#tools-that-honor-config)
- [Phase 2 GitHub Action](#phase-2-github-action)
- [See also](#see-also)

---

<br>

## Setup

```bash
mkdir -p .clockify
cp path/to/clockify-mcp-server/.clockify/config.yml.example .clockify/config.yml
# or run the clockify-project-init skill (preferred: also writes ignore defaults)
```

Point the MCP server at the repo when Cursor's cwd is wrong:

```json
"env": {
  "CLOCKIFY_CONFIG_ROOT": "${workspaceFolder}"
}
```

Or set `CLOCKIFY_CONFIG_PATH` to the full path of the config file.

<br>

---

<br>

## Git hygiene

- **Default:** do not commit `.clockify/`. Init writes a directory self-ignore and a managed stanza in the repo `.gitignore`.
- **Team opt-in:** delete the managed ignore block and commit `.clockify/` on purpose if the team wants shared standards. Still never commit API keys.
- **Cursor glue:** `.cursor/rules/clockify-time.mdc` is also listed in the managed stanza when automated init is used. Other `.cursor/` files stay team-owned; do not ignore all of `.cursor/`.
- **Cleanup:** run the `clockify-uninit` skill to remove config + Cursor glue surgically.
- A global `core.excludesfile` can ignore Clockify files in every repo; it is an extra option, not a substitute for init’s repo-local default.

<br>

---

<br>

## Discovery

1. `CLOCKIFY_CONFIG_PATH` (explicit file), else
2. `.clockify/config.yml` under the project root

Project root is the git/workspace root (parent of `.clockify/`), not the `.clockify` directory itself.

<br>

---

<br>

## Schema

| Key | Purpose |
|-----|---------|
| `project.name_from` | `repo` (folder name) or `fixed` with `project.name` |
| `rounding` | `enabled`, `increment_minutes`, `mode` (`nearest` \| `up` \| `down`) |
| `description.template` | Default `{issue_number} - {issue_title}` (renders `#N - title`). Also `{github_label}`, `{repo}` |
| `mapping.task_from` | `github_label` → Clockify tasks named like labels; `none` to skip |
| `automation.triggers` | AI/hook contract: `issue_start`, `issue_finish`, `issue_switch`, `pr_ship`, `pr_merged` |
| `automation.inactivity` | Stop guidance when a timer exceeds `stop_after_minutes` |

### Description placeholders

```yaml
description:
  template: "{issue_number} - {issue_title}"
```

With `issue_number: 1` and `issue_title: Wire Clockify MCP` that becomes `#1 - Wire Clockify MCP`.

### AI contract

Triggers run when an agent or Cursor hook is in the loop. Coding without AI means manual start/stop. That is expected.

`pr_merged` is for **phase 2** GitHub Actions (no local MCP). Phase 1 binds other events via skills/rules.

### Inactivity

Phase 1 is best-effort on agent/session boundaries (`clockify_get_running_timer` returns `inactivity.pastThreshold`). No background daemon while Cursor is closed.

<br>

---

<br>

## Tools that honor config

- `clockify_get_config` - effective yaml
- `clockify_start_timer` / `clockify_create_time_entry` - description template fields
- `clockify_stop_timer` / `clockify_create_time_entry` - rounding
- `clockify_ensure_project` / `clockify_ensure_task` - taxonomy bootstrap

<br>

---

<br>

## Phase 2 GitHub Action

Stop-on-merge without an agent needs a workflow calling the Clockify API with a secret (stdio MCP cannot receive webhooks):

1. Store `CLOCKIFY_API_KEY` (and workspace/user ids) as Actions secrets
2. On `pull_request` `closed` + `merged`, stop the running timer (or create a rounded entry)
3. Keep `.clockify/config.yml` `pr_merged` as documentation of intent

A full example can land under `examples/github-action/` later.

<br>

---

<br>

## See also

- [develop.md](./develop.md)
- [Docs index](./README.md)

<br>

---

<br>

<strong>Clockify MCP Server</strong>
<div align="right">

[MIT License](../LICENSE)

</div>
<br clear="both">
