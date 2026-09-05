---
name: clockify-unautomate
description: >-
  Turn off agent-mediated Clockify tracking: remove the clockify Cursor rule
  and Clockify-owned hooks, and disable automation in .clockify/config.yml
  (enabled false, clear forge triggers, platforms.cursor off). Keeps forge /
  on_start / mode settings so re-automate can restore without a full re-wizard.
  Use when the user wants to stop automation without uninstalling repo Clockify
  standards.
disable-model-invocation: true
---

# Clockify unautomate

Mode off. Confirm, then remove Cursor glue **and** turn off automation flags in yaml. Leave the repo contract (`.clockify/`) and forge/platform *settings* in place so `/clockify-automate` can turn them back on without re-asking everything.

To remove config as well, use [`clockify-uninit`](../clockify-uninit/SKILL.md).

## Confirm

1. Inventory with tools if needed, then **repeat the result in a normal chat message** (markdown list of paths). Do not rely on tool snippets as the only listing.
2. Chat list: rule + Clockify-owned hooks, and note that `.clockify/config.yml` will be patched to disable automation (not deleted). The managed `.clockify/` gitignore line stays.
3. Then AskQuestion with **only** a short confirm, e.g. “Turn off Clockify agent mode in this repo?” — do **not** put the inventory in the question box.
4. Do **not** delete `.clockify/` or the managed `.clockify/` gitignore line.
5. Do **not** uninstall the Clockify Agent Plugin unless the user explicitly asks.

## Removals

1. Delete `.cursor/rules/clockify.mdc` only (leave other rules alone). Also delete leftover `.cursor/rules/clockify-time.mdc` if present — do not leave either file.
2. Edit `.cursor/hooks.json`: drop **only** Clockify-owned hook entries (those that only invoke Clockify tools / were added by `clockify-automate`). Leave unrelated hooks intact. If the file becomes empty or `{}` with no remaining hooks, delete `hooks.json`.
3. If the managed gitignore stanza includes `.cursor/rules/clockify.mdc` or `.cursor/rules/clockify-time.mdc`, remove those lines (the rule file is gone). Keep:

   ```gitignore
   # Clockify Agent Plugin — personal time-tracking (delete this block to share with the team)
   .clockify/
   ```

   Normal path: the `.clockify/` stanza remains, so leave `.gitignore` in place. Edge case only: if after removing rule lines the file is empty or whitespace-only, delete it (same as empty `hooks.json`). Never delete a non-empty `.gitignore`. Full stanza teardown (and deleting an emptied file) is `clockify-uninit`.

4. **Patch `.clockify/config.yml`** (do not delete the file; do not wipe forge / on_start / mode definitions):

   - `entry.automated.enabled: false`
   - `entry.automated.triggers: []` (required when disabled)
   - `entry.automated.platforms.cursor.enabled: false` (leave `modes.*` blocks in place for a later re-automate)
   - Keep `entry.automated.forge`, `on_start`, rounding, overlap, inactivity, and Cursor mode names/settings

## Do not

- Wipe unrelated Cursor hooks or rules
- Delete `.clockify/` or a non-empty `.gitignore`
- Reset `forge` to `none` or delete `platforms.cursor.modes` unless the user asks for a full reset
- Uninstall Directory / local plugin or clear `CLOCKIFY_API_KEY`
- Treat tool output as the user-visible inventory (always restate paths in chat before AskQuestion)

## After

Automation is off in yaml and Cursor glue is gone. The user can `/clockify-start-timer`, `/clockify-stop-timer`, and `/clockify-enter-time` without agent-mediated triggers. `/clockify-automate` can re-enable using the preserved forge/platform settings.
