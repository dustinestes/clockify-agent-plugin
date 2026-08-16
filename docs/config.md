<br><br>
<img align="right" src="../assets/logo.svg" height="40" alt="Clockify MCP (unofficial)">
<h1>Config</h1>
<br clear="both">

Per-repo standards via `.clockify/config.yml`: project identity plus per-method description, task, rounding, overlap, and automation. API keys stay in MCP env / plugin variables - not in this file.

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
# or run the clockify-init skill (preferred: also writes ignore defaults)
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
- **Cleanup:** run `clockify-unautomate` to drop Cursor glue and keep config, or `clockify-uninit` for full local teardown.
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

Root keys: `version`, `project`, `timer`, `manual`, `automated`. Method blocks hold description, task, and overlap. Rounding and `include_seconds` apply to timer and automated only. Manual times are explicit.

| Key | Purpose |
|-----|---------|
| `project.name_from` | `repo` (folder name) or `fixed` with `project.name` |
| `*.description.from` | `prompt` (caller supplies the string) or `template` |
| `*.description.template` | `{issue_number}` `{issue_title}` `{github_label}` `{repo}`. Default `{issue_number} - {issue_title}` renders `#N - title` |
| `*.task.from` | `prompt`, `github_label`, or `none`. Automated allows `github_label` or `none` only |
| `*.task.if_missing` | When the Clockify task does not exist: `prompt`, `create` (`ensure_task`), or `none`. Automated: `create` or `none` |
| `timer.rounding` / `automated.rounding` | `enabled`, `increment_minutes`, `mode` (`nearest` \| `up` \| `down`), optional `start_mode` / `stop_mode` / `minimum_minutes` |
| `*.overlap.on_conflict` | `prompt` or `override` when a completed interval overlaps another entry |
| `automated.triggers` | AI/hook contract: `issue_start`, `issue_finish`, `issue_switch`, `pr_ship`, `pr_merged` |
| `automated.inactivity` | Stop guidance when a timer exceeds `stop_after_minutes` |

See [`.clockify/config.yml.example`](../.clockify/config.yml.example) for a full file.

### Description placeholders

```yaml
timer:
  description:
    from: template
    template: "{issue_number} - {issue_title}"
```

With `issue_number: 1` and `issue_title: Wire Clockify MCP` that becomes `#1 - Wire Clockify MCP`. When `from: prompt`, an omitted description is left blank rather than filled from the template.

### Rounding

`start_mode` / `stop_mode` fall back to `mode`. Start rounding applies when a timer is created (`include_seconds` floors to the UTC minute first). Stop rounding changes **end** only and does not re-round the stored start. If the rounded duration is zero, end is bumped by `increment_minutes`. When `minimum_minutes` is set, duration is at least that long after rounding.

Sequential switch: after a completed entry, the next timer start gap-fits to that entry’s end so independently rounded starts do not overlap it.

### Overlap

After rounding/gap-fit (or the explicit range on create-entry), tools list nearby completed entries. Abutting times are allowed. If another entry covers the same clock time:

- `prompt` — do not write; the tool returns the colliding entries. Retry with `confirm_overlap: true` to stack anyway (parallel work streams).
- `override` — write anyway.

Timers still cannot stack: Clockify allows one running timer. Overlap checks apply to completed intervals and to a new start that falls inside a completed entry.

### AI contract

Triggers run when an agent or Cursor hook is in the loop. Coding without AI means start/stop timer or enter an explicit range. That is expected.

`pr_merged` is for **phase 2** GitHub Actions (no local MCP). Phase 1 binds other events via skills/rules.

### Inactivity

Phase 1 is best-effort on agent/session boundaries (`clockify_get_running_timer` returns `inactivity.pastThreshold` from `automated.inactivity`). No background daemon while Cursor is closed.

<br>

---

<br>

## Tools that honor config

- `clockify_get_config` - effective yaml
- `clockify_start_timer` - optional `start`, `entry_method`, `timer`/`automated` include_seconds + start rounding + gap-fit + overlap
- `clockify_stop_timer` - `entry_method` end rounding, include_seconds, overlap
- `clockify_create_time_entry` - `manual`/`automated` description + overlap (no rounding)
- `clockify_get_running_timer` - `automated.inactivity`
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
