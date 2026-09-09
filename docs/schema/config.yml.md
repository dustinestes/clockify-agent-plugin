<br><br>
<img align="right" src="../../assets/logo.svg" height="40" alt="Clockify Agent Plugin">
<h1>config.yml</h1>
<br clear="both">

Field contract for `.clockify/config.yml` (plugin version **4**): `plugin` / `scope` / `entry`, plus per-method description, task, rounding, overlap, forge automation, and Cursor platforms. How the file gets on disk and how the server finds it (`config_root`, Cursor layouts): [config.md](../config.md). Init vs automate ladder: [config.md — Init vs Automate](../config.md#init-vs-automate). Copy-paste source (base scaffold after init): [`.clockify/config.yml.example`](../../.clockify/config.yml.example). Never put API keys here.

v1/v2/v3 configs fail closed — re-run `/clockify-init` (and `/clockify-automate` if you need automation), or replace `.clockify/config.yml` from the plugin example. That includes v2 root keys (`plugin_internal`, `entry_methods`) and `plugin.version` 2 or 3.

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
  - [Runaway](#runaway)
- [Tools that honor config](#tools-that-honor-config)

---

<br>

## Schema

Root keys: `plugin`, `scope`, `entry`. `scope` is where every entry and ensure_* goes (workspace and project). `entry.timer` / `manual` / `automated` are how time is entered. Rounding and `include_seconds` apply to timer and automated only. Manual times are explicit. Decision maps: [flows.md](../flows.md).

| Key | Purpose |
|-----|---------|
| `plugin.version` | Schema version (`4`). Plugin-owned; not for day-to-day edits. |
| `scope.workspace_id` | **Required** Clockify workspace pin (set during `/clockify-init`). Never follow the UI active workspace. Never put the API key here. |
| `scope.project.from` | `local_folder` (git toplevel / folder name), `fixed` with `scope.project.name`, or `prompt` (ask each session). Init defaults to `local_folder`; automate may set `fixed` or `prompt`. |
| `entry.timer` / `entry.manual` | Interactive methods: description + task + overlap; timer also has `include_seconds` and `rounding`. |
| `entry.timer.description.from` | `prompt` (caller supplies the string) or `template` |
| `entry.timer.description.template` | Tokens: `{issue_number}` `{issue_title}` `{label}` `{local_folder}`. Default `{issue_number} - {issue_title}` renders `#N - title` |
| `entry.manual.description.from` | `prompt` only (enter-time is not issue-driven; richer sources in [#74](https://github.com/dustinestes/clockify-agent-plugin/issues/74)). Leftover `template` keys are ignored |
| `entry.timer` / `manual` `task.from` | `prompt`, `template`, `fixed`, `local_folder`, or `none`. Timer default is `none` so `/clockify-start-timer` does not wait on a task name |
| `entry.*.task.template` / `name` | When `from: template`, expand `template`; when `from: fixed`, use literal `name` |
| `entry.*.task.if_missing` | When the Clockify task does not exist: `prompt`, `create` (`ensure_task`), or `none` |
| `entry.timer.rounding` / `automated.settings.rounding` | `enabled`, `increment_minutes`, `start_mode` / `stop_mode` (`nearest` \| `up` \| `down`), optional `minimum_minutes`. No `mode` key. |
| `entry.*.overlap.on_conflict` | `prompt` or `override` when a completed interval overlaps another entry (timer/manual at method root; automated under `settings`) |
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

Shape after init (and after `/clockify-unautomate`):

```yaml
entry:
  automated:
    enabled: false
    settings:
      include_seconds: false
      on_start:
        when_multiple_labels: first
        description:
          from: prompt
        task:
          from: none
          if_missing: none
      rounding:
        enabled: false
        increment_minutes: 15
        start_mode: nearest
        stop_mode: nearest
        minimum_minutes: 15
      overlap:
        on_conflict: prompt
      runaway:
        enabled: false
        stop_after_minutes: 45
    forge:
      github:
        enabled: false
      gitlab:
        enabled: false
      bitbucket:
        enabled: false
    triggers: []
    platforms:
      cursor:
        enabled: false
        modes: {}
```

| Key | Purpose |
|-----|---------|
| `enabled` | Live automation on/off. `true` after `/clockify-automate` (or `/clockify-automate-enable`). `false` after init, `/clockify-unautomate`, or `/clockify-automate-disable`. When false with **all forges off** and empty `triggers` = init/unautomate. When false with **one forge still enabled** (and triggers/modes kept) = **paused** (disable). |
| `settings` | Nest for include_seconds, on_start, rounding, overlap, runaway (timer-like knobs for automated starts/stops). |
| `settings.include_seconds` | Same role as timer: whether start/stop keep sub-minute precision before rounding. |
| `settings.on_start.when_multiple_labels` | When a template contains `{label}` and the work item has 2+ labels: `first` (forge/API list order) or `prompt` (AskQuestion). Default `first`. |
| `settings.on_start.description` | Forge start description: `from: prompt` \| `template` (+ `template` string). |
| `settings.on_start.task` | Forge start task: `from: prompt` \| `template` \| `fixed` \| `local_folder` \| `none`; `if_missing: create` \| `none` \| `prompt`. |
| `settings.rounding` | Same fields as timer rounding; see [Rounding](#rounding). |
| `settings.overlap` | Same as timer/manual overlap under `settings`. |
| `settings.runaway` | Clockify readiness: when a running timer exceeds `stop_after_minutes` (positive int; init default 45), AskQuestion before continuing. Automate wizard sets enable + minutes; hooks required when live automation and runaway are both on. |
| `forge` | Map of `github` / `gitlab` / `bitbucket`, each `{ enabled: boolean }`. At most one may be `true`. Only **github** is implemented; others are stubs. Init leaves all `false`. |
| `triggers` | Root array of forge event → action pairs (see [AI contract](#ai-contract-forge-triggers)). Require exactly one enabled forge. May remain when `enabled` is false (paused). |
| `platforms.cursor` | Plan/Debug mode blocks; see [Cursor platforms](#cursor-platforms). |

**Pause vs rollback**

| Want | Skill | Yaml |
|------|-------|------|
| Temporary pause, keep settings | `/clockify-automate-disable` → `/clockify-automate-enable` | `enabled: false`; keep one forge `enabled: true` / `settings.on_start` / triggers / `settings.runaway` prefs / `modes`; set `platforms.cursor.enabled: false` without clearing modes |
| Full rollback of automate settings | `/clockify-unautomate` | Reset `entry.automated` to example defaults (all forges `enabled: false`, empty `triggers`, modes cleared) |

Manual pause (same as disable): set `entry.automated.enabled: false` and `platforms.cursor.enabled: false` (keep `modes`); leave the active forge enabled; remove `.cursor/rules/clockify.mdc` and Clockify-owned runaway hooks. Manual resume: set `enabled: true`, restore `platforms.cursor.enabled` when modes should be live, rewrite the rule from config, reinstall hooks if `settings.runaway.enabled` is true. Do not clear forge/triggers/modes unless you intend a full unautomate.

`settings.on_start` applies to **forge starts** only. Stop triggers ignore it. When `clockify_start_timer` is called with `cursor_mode`, the matching `platforms.cursor.modes.<mode>` block overrides forge `settings.on_start`.

### Rounding

Rounding uses **`start_mode` and `stop_mode` only** (`nearest` \| `up` \| `down`). There is no `mode` key and no fallback to a shared mode. Defaults are `nearest` for both.

Start rounding applies when a timer is created (`include_seconds` floors to the UTC minute first). Stop rounding changes **end** only and does not re-round the stored start. If the rounded duration is zero, end is bumped by `increment_minutes`. When `minimum_minutes` is set, duration is at least that long after rounding.

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
| `triggers` | Array of `{ event, action }` — same shape as forge triggers. Mode events: `start` \| `stop`. Typical: `start` → `start_timer`, `stop` → `stop_timer` |
| `description.from` | `prompt` (default) or `template` |
| `task.from` | `fixed` (default) or `none`; fixed uses `name` (`agent_planning` / `agent_debug` by default) and `if_missing: create` |

Pass `cursor_mode: plan` or `cursor_mode: debug` on `clockify_start_timer` so the mode block overrides forge `settings.on_start`. Detection is **rule-first** (Cursor rules instruct the agent). Mode hooks are not supported ([#85](https://github.com/dustinestes/clockify-agent-plugin/issues/85) wontfix).

### Runaway

**Clockify readiness**, not IDE idle detection. When the plugin (or agent) next interacts with Clockify and finds a **running** timer whose duration already exceeds `stop_after_minutes`, AskQuestion so automations have an intentional state:

1. Keep running — valid long session
2. Stop and cap — end at `start + stop_after_minutes` (hard ceiling; **no stop rounding**)
3. Stop at now — full wall duration + normal rounding

Same check for in-session resume and for a preexisting timer started outside the plugin / before Cursor opened. Detection is a **floor** (at least N minutes before `pastCeiling`); not a guarantee of action at minute N. No background daemon. Intentional `/clockify-stop-timer` without `runaway_stop` ignores the ceiling.

Set by the `/clockify-automate` runaway wizard (`enabled` + `stop_after_minutes`) under `entry.automated.settings.runaway`. When live automation is on and `settings.runaway.enabled` is true, automate (or `/clockify-automate-enable`) **must** install Clockify-owned Cursor hooks (`sessionStart` / `sessionEnd` / `stop` via `.cursor/hooks/clockify-runaway.sh`) — fail-open; `sessionStart` instructs AskQuestion when `pastCeiling`. `/clockify-automate-disable` removes those hooks without flipping `settings.runaway.enabled` (so enable can restore them). `/clockify-unautomate` removes hooks as part of full rollback.

`stop_after_minutes` is a positive integer (YAML `15` or `"15"`). Init example default is 45; automate asks and may change it. Calibrate to workflow (e.g. “a timer this long would be unusual for my issue work”).

```yaml
entry:
  timer:
    rounding:
      enabled: true
      increment_minutes: 15
      start_mode: down
      stop_mode: down
  automated:
    settings:
      runaway:
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
- `clockify_get_running_timer` - `entry.automated.settings.runaway`
- `clockify_ensure_project` / `clockify_ensure_task` - taxonomy bootstrap (`client_id` on create; `clockify_set_project_client` to assign on existing)

---

<br>

<strong>Clockify Agent Plugin</strong>
<div align="right">

[MIT License](../../LICENSE)

</div>
<br clear="both">
