<br><br>
<img align="right" src="../../assets/logo.svg" height="40" alt="Clockify Agent Plugin">
<h1>config.yml</h1>
<br clear="both">

Field contract for `.clockify/config.yml`: project identity plus per-method description, task, rounding, overlap, and automation. How the file gets on disk and how the server finds it (`config_root`, Cursor layouts): [config.md](../config.md). How git lines up with Clockify (repo as project vs repo as task): [config.md — shape](../config.md#shape). Copy-paste source: [`.clockify/config.yml.example`](../../.clockify/config.yml.example). Never put API keys here.

<br>

## Contents

- [Contents](#contents)
- [Schema](#schema)
  - [Description placeholders](#description-placeholders)
  - [Rounding](#rounding)
  - [Overlap](#overlap)
  - [AI contract](#ai-contract)
  - [Inactivity](#inactivity)
- [Tools that honor config](#tools-that-honor-config)

---

<br>

## Schema

Root keys: `version`, `workspace_id`, `project`, `timer`, `manual`, `automated`. Method blocks hold description, task, and overlap. Rounding and `include_seconds` apply to timer and automated only. Manual times are explicit.

| Key | Purpose |
|-----|---------|
| `workspace_id` | Optional Clockify workspace pin (set during `/clockify-init`). Never put the API key here. |
| `project.from` | `repo` (folder name) or `fixed` with `project.name` — see [shapes](../config.md#shape) |
| `*.description.from` | `prompt` (caller supplies the string) or `template` |
| `*.description.template` | `{issue_number}` `{issue_title}` `{github_label}` `{repo}`. Default `{issue_number} - {issue_title}` renders `#N - title` |
| `*.task.from` | `prompt`, `github_label`, `repo` (git toplevel folder name), or `none`. Automated allows `github_label`, `repo`, or `none` only — see [repo as task](../config.md#repo-as-task) |
| `*.task.if_missing` | When the Clockify task does not exist: `prompt`, `create` (`ensure_task`), or `none`. Automated: `create` or `none` |
| `timer.rounding` / `automated.rounding` | `enabled`, `increment_minutes`, `mode` (`nearest` \| `up` \| `down`), optional `start_mode` / `stop_mode` / `minimum_minutes` |
| `*.overlap.on_conflict` | `prompt` or `override` when a completed interval overlaps another entry |
| `automated.triggers` | Local AI/hook contract: `issue_start`, `issue_finish`, `issue_switch`, `pr_ship`, `pr_closed` |
| `automated.inactivity` | Stop guidance when a timer exceeds `stop_after_minutes` (positive int; default 45) |

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

Triggers are a **local** agent/hook contract. They fire when you (or the agent) do the work in this session — not when GitHub or Clockify change on their own. Coding without AI means start/stop timer or enter an explicit range. That is expected.

| Event | When (in this session) | Typical action |
|-------|------------------------|----------------|
| `issue_start` | Start work or planning on an issue | `start_timer` |
| `issue_finish` | Finish issue work | `stop_timer` |
| `issue_switch` | Move to a different issue | `stop_then_start` |
| `pr_ship` | Open or push a PR | `stop_timer` |
| `pr_closed` | Close or abandon a PR | `stop_timer` |

`pr_ship` is shipping (open/push). `pr_closed` is closing or abandoning in this session. `pr_merged` is not supported: GitHub merge is an unwatched action.

Invalid events fail validation with the field path and the allowed list (`issue_start`, `issue_finish`, `issue_switch`, `pr_ship`, `pr_closed`).

### Inactivity

Best-effort on agent/session boundaries (`clockify_get_running_timer` returns `inactivity.pastThreshold` from `automated.inactivity`). No background daemon while Cursor is closed.

`stop_after_minutes` is a positive integer (YAML `15` or `"15"`). Default is 45.

```yaml
timer:
  rounding:
    enabled: true
    increment_minutes: 15
    mode: down
automated:
  inactivity:
    enabled: true
    stop_after_minutes: 15
```

---

<br>

## Tools that honor config

Full catalog: [mcp.md](../mcp.md). Tools that read `.clockify/config.yml`:

- `clockify_get_config` - effective yaml
- `clockify_start_timer` - optional `start`, `entry_method`, `timer`/`automated` include_seconds + start rounding + gap-fit + overlap
- `clockify_stop_timer` - `entry_method` end rounding, include_seconds, overlap
- `clockify_create_time_entry` - `manual`/`automated` description + overlap (no rounding)
- `clockify_get_running_timer` - `automated.inactivity`
- `clockify_ensure_project` / `clockify_ensure_task` - taxonomy bootstrap

---

<br>

<strong>Clockify Agent Plugin</strong>
<div align="right">

[MIT License](../../LICENSE)

</div>
<br clear="both">
