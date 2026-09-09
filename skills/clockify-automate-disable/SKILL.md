---
name: clockify-automate-disable
description: >-
  Temporarily pause agent-mediated Clockify tracking without wiping settings:
  remove the clockify Cursor rule and Clockify-owned runaway hooks, set
  entry.automated.enabled false and platforms.cursor.enabled false, but keep
  forge, settings.on_start, triggers, settings.runaway prefs, and modes.
  Distinct from clockify-unautomate (full rollback). Use when the user wants a
  pause they can resume with clockify-automate-enable.
disable-model-invocation: true
---

# Clockify automate disable

**Pause**, not a rollback. Confirm, then inert Cursor glue and flip live-automation flags off while **retaining** forge / `settings.on_start` / triggers / `settings.runaway` prefs / `platforms.cursor.modes`.

Full rollback (wipe automate-owned yaml toward init defaults): [`clockify-unautomate`](../clockify-unautomate/SKILL.md). Resume later: [`clockify-automate-enable`](../clockify-automate-enable/SKILL.md).

## Config root

Pass `config_root` on Clockify MCP calls. If it is already known this session and still this repo, **reuse it**. Otherwise resolve once with `git rev-parse --show-toplevel` from the working directory (same rules as automate).

## Prerequisites

1. Load config (`clockify_get_config` with `config_root`). If missing, say so and stop — there is nothing to pause.
2. **Never automated** (init / after unautomate): all `entry.automated.forge.*.enabled` are false (and typically empty triggers / empty modes). Chat that automate was never turned on (or was fully rolled back); suggest `/clockify-automate` if they want automation. Do not invent settings.
3. **Already paused** (`enabled: false` and any `forge.*.enabled` is true): still confirm and re-run glue removals (idempotent). Chat that settings are already paused; glue cleanup still runs if leftovers exist.
4. **Active** (`enabled: true` and any `forge.*.enabled` is true): normal disable path below.

## Confirm

1. Inventory with tools if needed, then **repeat the result in a normal chat message** (markdown list of paths and yaml intent). Do not rely on tool snippets as the only listing.
2. Chat list: rule + Clockify-owned hooks (including `.cursor/hooks/clockify-runaway.sh` when present), and note that `entry.automated.enabled` and `platforms.cursor.enabled` will become `false` while **forge / settings.on_start / triggers / settings.runaway / modes stay**. Note empty dirs that will be removed if they become empty after cleanup. The managed `.clockify/` gitignore line stays. `plugin` / `scope` / `entry.timer` / `entry.manual` are not touched.
3. Then AskQuestion with **only** a short confirm, e.g. “Pause Clockify automate in this repo (keep settings)?” — do **not** put the inventory in the question box.
4. Do **not** delete `.clockify/` or the managed `.clockify/` gitignore line.
5. Do **not** uninstall the Clockify Agent Plugin unless the user explicitly asks.
6. Do **not** reset `entry.automated` to example defaults — that is unautomate.

## Removals (Cursor glue)

Same surgical glue cleanup as [`clockify-unautomate`](../clockify-unautomate/SKILL.md) for rules/hooks/gitignore lines — **without** resetting yaml to defaults:

1. Delete `.cursor/rules/clockify.mdc` only (leave other rules alone). Also delete leftover `.cursor/rules/clockify-time.mdc` if present. If `.cursor/rules/` is then **empty**, delete the empty directory. Never delete a non-empty `rules/` dir or unrelated `*.mdc` files.
2. Edit `.cursor/hooks.json`: drop **only** Clockify-owned hook entries — those whose `command` references `clockify-runaway` / `.cursor/hooks/clockify-runaway.sh`, or that only invoke Clockify tools / were added by `clockify-automate`. Leave unrelated hooks intact. Delete `.cursor/hooks/clockify-runaway.sh` if present. If the file becomes empty or `{}` with no remaining hooks, delete `hooks.json`. If `.cursor/hooks/` is then **empty**, delete the empty directory. Never delete unrelated hook scripts or a non-empty `hooks/` dir. Do **not** delete `.cursor/` wholesale.
3. If the managed gitignore stanza includes `.cursor/rules/clockify.mdc`, `.cursor/rules/clockify-time.mdc`, or `.cursor/hooks/clockify-runaway.sh`, remove those lines (the rule/script files are gone). Keep:

   ```gitignore
   # Clockify Agent Plugin — personal time-tracking (delete this block to share with the team)
   .clockify/
   ```

   Normal path: the `.clockify/` stanza remains, so leave `.gitignore` in place. Edge case only: if after removing rule/hook-script lines the file is empty or whitespace-only, delete it. Never delete a non-empty `.gitignore`. Full stanza teardown is `clockify-uninit`.

## Patch yaml (pause flags only)

Patch `.clockify/config.yml` — do **not** wipe forge, `settings.on_start`, `triggers`, `settings.runaway`, or `modes`:

- `entry.automated.enabled: false`
- If `platforms.cursor.modes` is non-empty (or `platforms.cursor` exists): `entry.automated.platforms.cursor.enabled: false`
- Do **not** change `settings.runaway.enabled` or `stop_after_minutes` (enable uses these to decide whether to reinstall hooks)
- Do **not** clear `triggers`, `forge` (including `forge.*.enabled`), `settings.on_start`, or `modes`
- Do **not** touch `plugin`, `scope`, `entry.timer`, or `entry.manual`

## Do not

- Reset `entry.automated` to example defaults (that is `/clockify-unautomate`)
- Clear forge / `settings.on_start` / triggers / modes “for cleanliness”
- Flip `settings.runaway.enabled` off (keep the user’s preference)
- Wipe unrelated Cursor hooks or rules
- Delete a non-empty `.cursor/hooks/` or `.cursor/rules/` directory
- Delete `.cursor/` wholesale
- Delete `.clockify/` or a non-empty `.gitignore`
- Uninstall Directory / local plugin or clear `CLOCKIFY_API_KEY`
- Treat tool output as the user-visible inventory (always restate paths in chat before AskQuestion)

## After

Automation is paused. Timer / stop / enter-time still work. Resume with `/clockify-automate-enable` (or re-run `/clockify-automate`, which skips wizards when any `forge.*.enabled` is already true). Full rollback: `/clockify-unautomate`.
