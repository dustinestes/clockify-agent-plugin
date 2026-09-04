<br><br>
<img align="right" src="../../assets/logo.svg" height="40" alt="Clockify Agent Plugin">
<h1>config.yml</h1>
<br clear="both">

Field contract for `.clockify/config.yml` (plugin version **3**): `plugin` / `scope` / `entry`, plus per-method description, task, rounding, overlap, forge automation, and Cursor platforms. How the file gets on disk and how the server finds it (`config_root`, Cursor layouts): [config.md](../config.md). Init vs automate ladder: [config.md — Init vs Automate](../config.md#init-vs-automate). Copy-paste source (base scaffold after init): [`.clockify/config.yml.example`](../../.clockify/config.yml.example). Never put API keys here.

v2 root keys (`plugin_internal`, `entry_methods`) fail closed — re-run `/clockify-init` (and `/clockify-automate` if you need automation).

<br>

## Contents

- [Contents](#contents)
- [Schema](#schema)
  - [Description and task strategies](#description-and-task-strategies)
  - [Description placeholders](#description-placeholders)
  - [Automated (`entry.automated`)](#automated-entryautomated)
  - [Rounding](#rounding)
  - [Overlap](#overlap)
  - [AI contract (forge triggers)](#ai-contract-forge-triggers)
  - [Cursor platforms](#cursor-platforms)
  - [Inactivity](#inactivity)
- [Tools that honor config](#tools-that-honor-config)

---

<br>

## Schema

Root keys: `plugin`, `scope`, `entry`. `scope` is where every entry and ensure_* goes (workspace and project). `entry.timer` / `manual` / `automated` are how time is entered. Rounding and `include_seconds` apply to timer and automated only. Manual times are explicit. Decision maps: [flows.md](../flows.md).

| Key | Purpose |
|-----|---------|
| `plugin.version` | Schema version (`3`). Plugin-owned; not for day-to-day edits. |
| `scope.workspace_id` | **Required** Clockify workspace pin (set during `/clockify-init`). Never follow the UI active workspace. Never put the API key here. |
| `scope.project.from` | `local_folder` (git toplevel / folder name), `fixed` with `scope.project.name`, or `prompt` (ask each session). Init defaults to `local_folder`; automate may set `fixed` or `prompt`. |
| `entry.timer` / `entry.manual` | Interactive methods: description + task + overlap; timer also has `include_seconds` and `rounding`. |
| `entry.timer.description.from` | `prompt` (caller supplies the string) or `template` |
| `entry.timer.description.template` | Tokens: `{issue_number}` `{issue_title}` `{label}` `{local_folder}`. Default `{issue_number} - {issue_title}` renders `#N - title` |
| `entry.manual.description.from` | `prompt` only (enter-time is not issue-driven; richer sources in [#74](https://github.com/dustinestes/clockify-agent-plugin/issues/74)). Leftover `template` keys are ignored |
| `entry.timer` / `manual` `task.from` | `prompt`, `template`, `fixed`, `local_folder`, or `none`. Timer default is `none` so `/clockify-start-timer` does not wait on a task name |
| `entry.*.task.template` / `name` | When `from: template`, expand `template`; when `from: fixed`, use literal `name` |
| `entry.*.task.if_missing` | When the Clockify task does not exist: `prompt`, `create` (`ensure_task`), or `none` |
| `entry.timer.rounding` / `automated.rounding` | `enabled`, `increment_minutes`, `mode` (`nearest` \| `up` \| `down`), optional `start_mode` / `stop_mode` / `minimum_minutes` |
| `entry.*.overlap.on_conflict` | `prompt` or `override` when a completed interval overlaps another entry |
| `entry.automated` | See [Automated](#automated-entryautomated) |

### Description and task strategies

Same mental model for description and task (where applicable):

| `from` | Meaning |
|--------|---------|
| `prompt` | Caller / agent supplies the string |
| `template` | Expand `template` with tokens |
| `fixed` | Literal `name` (task only) |
| `local_folder` | Git toplevel / folder name |
| `none` | No task (task only) |

`task.from` is still an enum — it keys resolution strategy. Tokens live *inside* `template` when `from: template`. Label logic runs when the template contains `{label}`.

Leftover `github_label` / `repo` values fail validation (`use from: template` with `{label}`; `repo` → `local_folder`).

### Description placeholders

```yaml
entry:
  timer:
    description:
      from: template
      template: "{issue_number} - {issue_title}"
```

With `issue_number: 1` and `issue_title: Wire Clockify MCP` that becomes `#1 - Wire Clockify MCP`. When `from: prompt`, an omitted description is left blank rather than filled from the template. Manual enter-time does not use templates — only `entry.manual.description.from: prompt`.

**Tokens** (description and task templates): `{issue_number}`, `{issue_title}`, `{label}`, `{local_folder}`. For Cursor Plan/Debug mode templates: `{planTitle}`, `{debugTitle}`.

Pass forge fields on tools as `issue_number` / `issue_title` / `label` (deprecated alias: `github_label`). Cursor mode titles: `plan_title` / `debug_title` on `clockify_start_timer`.

### Automated (`entry.automated`)

| Key | Purpose |
|-----|---------|
| `enabled` | `false` after init; `true` after `/clockify-automate`. When `false`, `triggers` must be empty. |
| `forge` | `none` \| `github` \| `gitlab` \| `bitbucket`. Only **github** is implemented; others are stubs. Init leaves `none`. |
| `include_seconds` | Same role as timer: whether start/stop keep sub-minute precision before rounding. |
| `on_start.when_multiple_labels` | When a template contains `{label}` and the work item has 2+ labels: `first` (forge/API list order) or `prompt` (AskQuestion). Default `first`. |
| `on_start.description` | Forge start description: `from: prompt` \| `template` (+ `template` string). |
| `on_start.task` | Forge start task: `from: prompt` \| `template` \| `fixed` \| `local_folder` \| `none`; `if_missing: create` \| `none` \| `prompt`. |
| `triggers` | Forge event → action pairs (see [AI contract](#ai-contract-forge-triggers)). Require `enabled: true` and a real forge (not `none`). |
| `inactivity` | Stop guidance when a timer exceeds `stop_after_minutes` (positive int; default 45). |
| `platforms.cursor` | Plan/Debug mode blocks; see [Cursor platforms](#cursor-platforms). |

`on_start` applies to **forge starts** only. Stop triggers ignore it. When `clockify_start_timer` is called with `cursor_mode`, the matching `platforms.cursor.modes.<mode>` block overrides forge `on_start`.

### Rounding

`start_mode` / `stop_mode` fall back to `mode`. Start rounding applies when a timer is created (`include_seconds` floors to the UTC minute first). Stop rounding changes **end** only and does not re-round the stored start. If the rounded duration is zero, end is bumped by `increment_minutes`. When `minimum_minutes` is set, duration is at least that long after rounding.

Sequential switch: after a completed entry, the next timer start gap-fits to that entry’s end so independently rounded starts do not overlap it.

### Overlap

After rounding/gap-fit (or the explicit range on create-entry), tools list nearby completed entries. Abutting times are allowed. If another entry covers the same clock time:

- `prompt` — do not write; the tool returns the colliding entries. Retry with `confirm_overlap: true` to stack anyway (parallel work streams).
- `override` — write anyway.

Timers still cannot stack: Clockify allows one running timer. Overlap checks apply to completed intervals and to a new start that falls inside a completed entry.

### AI contract (forge triggers)

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

### Cursor platforms

Under `entry.automated.platforms.cursor`:

| Key | Purpose |
|-----|---------|
| `enabled` | `true` when any mode is on |
| `modes.plan` / `modes.debug` | Per-mode blocks |

Each mode:

| Key | Purpose |
|-----|---------|
| `enabled` | Mode on/off |
| `triggers` | `start` → `start_timer`, `stop` → `stop_timer` |
| `description.from` | `prompt` (default) or `template` |
| `task.from` | `fixed` (default) or `none`; fixed uses `name` (`agent_planning` / `agent_debug` by default) and `if_missing: create` |

Pass `cursor_mode: plan` or `cursor_mode: debug` on `clockify_start_timer` so the mode block overrides forge `on_start`. Detection is **rule-first** (Cursor rules instruct the agent). Optional hook-based mode detection: [issue #85](https://github.com/dustinestes/clockify-agent-plugin/issues/85).

### Inactivity

Best-effort on agent/session boundaries (`clockify_get_running_timer` returns `inactivity.pastThreshold` from `entry.automated.inactivity`). No background daemon while Cursor is closed.

`stop_after_minutes` is a positive integer (YAML `15` or `"15"`). Default is 45.

```yaml
entry:
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
- `clockify_start_timer` - optional `start`, `entry_method`, `cursor_mode`, `label` / template fields; timer/`automated` include_seconds + start rounding + gap-fit + overlap
- `clockify_stop_timer` - `entry_method` end rounding, include_seconds, overlap
- `clockify_create_time_entry` - `manual`/`automated` description + overlap (no rounding)
- `clockify_get_running_timer` - `entry.automated.inactivity`
- `clockify_ensure_project` / `clockify_ensure_task` - taxonomy bootstrap (`client_id` on create; `clockify_set_project_client` to assign on existing)

---

<br>

<strong>Clockify Agent Plugin</strong>
<div align="right">

[MIT License](../../LICENSE)

</div>
<br clear="both">
