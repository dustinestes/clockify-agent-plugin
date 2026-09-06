---
name: clockify-unautomate
description: >-
  Full rollback of agent-mediated Clockify tracking: remove the clockify Cursor
  rule and Clockify-owned hooks, and reset entry.automated in .clockify/config.yml
  to init/example defaults (forge none, empty triggers, platforms.cursor off,
  modes cleared). Does not change plugin, scope, timer, or manual. Use when the
  user wants to undo automate — not a temporary pause (that is a future
  disable/enable skill).
disable-model-invocation: true
---

# Clockify unautomate

**Rollback**, not a pause. Confirm, then remove Cursor glue and reset **only** automate-owned yaml to the plugin example defaults. Everything outside `entry.automated` stays (workspace pin, project, timer, manual).

Temporary disable while keeping forge/platform settings is **out of scope** here — that is [`clockify-automate-disable` / `enable`](https://github.com/dustinestes/clockify-agent-plugin/issues/87) (future).

To remove `.clockify/` entirely, use [`clockify-uninit`](../clockify-uninit/SKILL.md).

## Confirm

1. Inventory with tools if needed, then **repeat the result in a normal chat message** (markdown list of paths). Do not rely on tool snippets as the only listing.
2. Chat list: rule + Clockify-owned hooks (including `.cursor/hooks/clockify-inactivity.sh` when present), and note that `entry.automated` in `.clockify/config.yml` will be **reset to example defaults** (forge/on_start/modes wiped). The managed `.clockify/` gitignore line stays. `plugin` / `scope` / `entry.timer` / `entry.manual` are not touched.
3. Then AskQuestion with **only** a short confirm, e.g. “Roll back Clockify automate in this repo?” — do **not** put the inventory in the question box.
4. Do **not** delete `.clockify/` or the managed `.clockify/` gitignore line.
5. Do **not** uninstall the Clockify Agent Plugin unless the user explicitly asks.

## Removals

1. Delete `.cursor/rules/clockify.mdc` only (leave other rules alone). Also delete leftover `.cursor/rules/clockify-time.mdc` if present — do not leave either file.
2. Edit `.cursor/hooks.json`: drop **only** Clockify-owned hook entries — those whose `command` references `clockify-inactivity` / `.cursor/hooks/clockify-inactivity.sh`, or that only invoke Clockify tools / were added by `clockify-automate`. Leave unrelated hooks intact. Delete `.cursor/hooks/clockify-inactivity.sh` if present. If the file becomes empty or `{}` with no remaining hooks, delete `hooks.json`.
3. If the managed gitignore stanza includes `.cursor/rules/clockify.mdc` or `.cursor/rules/clockify-time.mdc`, remove those lines (the rule file is gone). Keep:

   ```gitignore
   # Clockify Agent Plugin — personal time-tracking (delete this block to share with the team)
   .clockify/
   ```

   Normal path: the `.clockify/` stanza remains, so leave `.gitignore` in place. Edge case only: if after removing rule lines the file is empty or whitespace-only, delete it (same as empty `hooks.json`). Never delete a non-empty `.gitignore`. Full stanza teardown (and deleting an emptied file) is `clockify-uninit`.

4. **Reset `entry.automated` in `.clockify/config.yml`** to match the plugin [`.clockify/config.yml.example`](../../.clockify/config.yml.example) automated block (do not delete the file; do not rewrite `plugin`, `scope`, `entry.timer`, or `entry.manual`):

   ```yaml
   automated:
     enabled: false
     forge: none
     include_seconds: false
     on_start:
       when_multiple_labels: first
       description:
         from: prompt
       task:
         from: none
         if_missing: none
     rounding:
       enabled: true
       increment_minutes: 15
       mode: nearest
       start_mode: nearest
       stop_mode: nearest
       minimum_minutes: 15
     overlap:
       on_conflict: prompt
     triggers: []
     inactivity:
       enabled: true
       stop_after_minutes: 45
     platforms:
       cursor:
         enabled: false
         modes: {}
   ```

   Prefer replacing the whole `entry.automated` mapping with the example defaults above so leftover forge/`on_start`/`modes` keys cannot linger. If the user’s timer/manual rounding differs from the example, still only touch `entry.automated` — do not copy automated rounding onto timer/manual.

## Do not

- Wipe unrelated Cursor hooks or rules
- Delete `.clockify/` or a non-empty `.gitignore`
- Leave forge / `on_start` / `platforms.cursor.modes` in place “for convenience”
- Invent retain-vs-reask rules for a later `/clockify-automate` — the next automate run is a full wizard again
- Change `scope.project` (even if automate set `fixed`) unless the user asks — project pin is shared with timer/manual
- Uninstall Directory / local plugin or clear `CLOCKIFY_API_KEY`
- Treat tool output as the user-visible inventory (always restate paths in chat before AskQuestion)

## After

Automate is fully rolled back. The user can `/clockify-start-timer`, `/clockify-stop-timer`, and `/clockify-enter-time`. Running `/clockify-automate` again asks the forge + Cursor wizards from scratch.
