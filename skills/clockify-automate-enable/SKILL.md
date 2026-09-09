---
name: clockify-automate-enable
description: >-
  Resume agent-mediated Clockify tracking after clockify-automate-disable:
  set entry.automated.enabled true, restore platforms.cursor.enabled from
  preserved modes, rewrite .cursor/rules/clockify.mdc, and reinstall runaway
  hooks when settings.runaway.enabled is still true. Skips forge/Cursor/runaway
  wizards unless settings are missing — then redirect to clockify-automate. Use
  when the user wants to turn automation back on without a full re-wizard.
disable-model-invocation: true
---

# Clockify automate enable

**Resume** after a pause. Confirm, then flip live-automation flags on and restore Cursor glue from **preserved** yaml. Do not re-run forge / Cursor / runaway wizards unless required fields are missing.

First-time automation or after `/clockify-unautomate`: [`clockify-automate`](../clockify-automate/SKILL.md). Temporary pause: [`clockify-automate-disable`](../clockify-automate-disable/SKILL.md).

## Config root

Pass `config_root` on Clockify MCP calls. If it is already known this session and still this repo, **reuse it**. Otherwise resolve once with `git rev-parse --show-toplevel` from the working directory (same rules as automate).

## Prerequisites

1. Load config (`clockify_get_config` with `config_root`). If missing, run [`clockify-init`](../clockify-init/SKILL.md) is not enough for automate — tell the user to run `/clockify-automate` (full wizards). Stop.
2. **Init / after unautomate** (all `forge.*.enabled` false, typically empty triggers / empty modes): settings were never kept. Chat that enable cannot restore what was rolled back; redirect to `/clockify-automate`. Do not invent forge/triggers/modes.
3. **Paused** (`enabled: false` and any `forge.*.enabled` is true): normal enable path below.
4. **Already active** (`enabled: true` and any `forge.*.enabled` is true): still confirm; refresh rule (and runaway hooks if `settings.runaway.enabled`) from current yaml — idempotent, no wizards unless the user asks to reconfigure (then hand off to `/clockify-automate`).

## Confirm

1. Inventory with tools if needed, then **repeat the result in a normal chat message** (markdown list). Do not rely on tool snippets as the only listing.
2. Chat list: what will be restored — `entry.automated.enabled: true`, `platforms.cursor.enabled` when modes warrant it, rewrite `.cursor/rules/clockify.mdc`, and reinstall runaway hooks **only if** `settings.runaway.enabled` is true. Note forge / triggers / modes already on disk (not re-asked).
3. Then AskQuestion with **only** a short confirm, e.g. “Resume Clockify automate from saved settings?” — do **not** put the inventory in the question box.
4. Do **not** re-run forge / Cursor / runaway AskQuestion wizards on this path.

## Patch yaml

Patch `.clockify/config.yml` (do not wipe unrelated keys):

- `entry.automated.enabled: true`
- If `platforms.cursor.modes` has any mode with `enabled: true` (or any mode block present that should be live): set `platforms.cursor.enabled: true`. If modes is `{}` or every mode is explicitly off, leave `platforms.cursor.enabled: false`.
- Do **not** change forge, `settings.on_start`, `triggers`, `settings.runaway`, or mode block contents unless the user asks to reconfigure (then use `/clockify-automate`).
- Do **not** touch `plugin`, `scope`, `entry.timer`, or `entry.manual`.

## Write Cursor rules

Add or update `.cursor/rules/clockify.mdc` from the **declared** config (triggers + platforms) using the same contract and rule snippet as [`clockify-automate`](../clockify-automate/SKILL.md) (**Write Cursor rules** + **Rule snippet** sections). Honor preserved `settings.on_start`, forge triggers, Plan/Debug modes, and runaway AskQuestion behavior.

Also:

1. Leftover rename: if `.cursor/rules/clockify-time.mdc` still exists, move its content into `clockify.mdc` (or delete it after writing the new file). Do **not** leave both rule files.
2. In the managed `.gitignore` stanza, ensure `.cursor/rules/clockify.mdc` is listed and drop any `.cursor/rules/clockify-time.mdc` line.

## Runaway hooks

Follow [`clockify-automate`](../clockify-automate/SKILL.md) **Runaway hooks**:

- When `entry.automated.settings.runaway.enabled` is **true**: copy [`../clockify-automate/hooks/clockify-runaway.sh`](../clockify-automate/hooks/clockify-runaway.sh) to `.cursor/hooks/clockify-runaway.sh`, `chmod +x`, merge `sessionStart` / `sessionEnd` / `stop` entries in `.cursor/hooks.json`, add the script path to the managed gitignore stanza.
- When `settings.runaway.enabled` is **false**: ensure Clockify-owned runaway hooks/script are absent (same cleanup as automate when runaway is off).

Do not fork a second copy of the runaway script under this skill folder.

## Ensure (light)

Only when needed for consistency with preserved config (skip if already done this session and nothing changed):

1. When `scope.project.from` is `local_folder` or `fixed`, `clockify_ensure_project` with `config_root` (do not re-run the full client AskQuestion picker unless the project is missing and has no client — then follow automate’s client flow).
2. Cursor fixed tasks: for each enabled Cursor mode with `task.from: fixed`, `clockify_ensure_task` for that `name`.
3. Do **not** re-sync all GitHub labels unless the user asks or `{label}` templates are in use and tasks are clearly missing.

## Do not

- Re-run forge / Cursor / runaway wizards when any `forge.*.enabled` is already true
- Invent forge/triggers/modes when all `forge.*.enabled` are false — redirect to `/clockify-automate`
- Reset yaml toward unautomate defaults
- Install runaway hooks when `settings.runaway.enabled` is false
- Leave orphan Clockify runaway hooks when `settings.runaway.enabled` is false
- Duplicate `clockify-init` or full `clockify-automate` wizard steps here
- Treat tool output as the user-visible inventory (always restate in chat before AskQuestion)

## After

Automation is live again from preserved settings. To reconfigure forge/platforms/runaway, run `/clockify-automate` and ask to reconfigure. To pause again: `/clockify-automate-disable`. Full rollback: `/clockify-unautomate`.
