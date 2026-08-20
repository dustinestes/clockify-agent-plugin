---
name: clockify-unautomate
description: >-
  Turn off agent-mediated Clockify tracking: remove the clockify Cursor rule
  and Clockify-owned hooks. Keeps .clockify/config.yml so start-timer and
  enter-time still work. Use when the user wants to stop automation without
  uninstalling repo Clockify standards.
disable-model-invocation: true
---

# Clockify unautomate

Mode off. Confirm, then remove Cursor glue only. Leave the repo contract (`.clockify/`) in place.

To remove config as well, use [`clockify-uninit`](../clockify-uninit/SKILL.md).

## Confirm

1. Summarize what will be removed (rule + Clockify-owned hooks only).
2. Do **not** delete `.clockify/` or the managed `.clockify/` gitignore line.
3. Do **not** uninstall the Clockify Agent Plugin unless the user explicitly asks.

## Removals

1. Delete `.cursor/rules/clockify.mdc` only (leave other rules alone). Also delete leftover `.cursor/rules/clockify-time.mdc` if present — do not leave either file.
2. Edit `.cursor/hooks.json`: drop **only** Clockify-owned hook entries (those that only invoke Clockify tools / were added by `clockify-automate`). Leave unrelated hooks intact. If the file becomes empty or `{}` with no remaining hooks, delete `hooks.json`.
3. If the managed gitignore stanza includes `.cursor/rules/clockify.mdc` or `.cursor/rules/clockify-time.mdc`, remove those lines (the rule file is gone). Keep:

   ```gitignore
   # Clockify Agent Plugin — personal time-tracking (delete this block to share with the team)
   .clockify/
   ```

   Normal path: the `.clockify/` stanza remains, so leave `.gitignore` in place. Edge case only: if after removing rule lines the file is empty or whitespace-only, delete it (same as empty `hooks.json`). Never delete a non-empty `.gitignore`. Full stanza teardown (and deleting an emptied file) is `clockify-uninit`.

## Do not

- Wipe unrelated Cursor hooks or rules
- Delete `.clockify/` or a non-empty `.gitignore`
- Uninstall Directory / local plugin or clear `CLOCKIFY_API_KEY`

## After

Config remains. The user can `/clockify-start-timer`, `/clockify-stop-timer`, and `/clockify-enter-time` without agent-mediated triggers.
