---
name: clockify-uninit
description: >-
  Remove Clockify integration artifacts from a consumer repo: .clockify/,
  clockify-time rule, Clockify-owned hooks, and the managed gitignore stanza.
  Use when uninstalling project-level Clockify standards. Does not uninstall the
  MCP server or Cursor plugin unless the user asks.
---

# Clockify uninit

Surgical cleanup of Clockify-owned files in a **consumer** repo. Confirm with the user before deleting.

## Confirm

1. Summarize what will be removed (paths below).
2. If `.clockify/.managed-by-init` is missing, still offer to remove the same well-known paths after explicit confirmation (user may have edited by hand).
3. Do **not** uninstall the MCP server / user-level Cursor plugin unless the user explicitly asks.

## Removals

1. Delete `.clockify/` entirely (config, marker, self-ignore, any extras).
2. Delete `.cursor/rules/clockify-time.mdc` only (leave other rules alone).
3. Edit `.cursor/hooks.json`: drop **only** Clockify-owned hook entries (e.g. those that only invoke Clockify tools / were added by automated init). Leave unrelated hooks intact. If the file becomes empty or `{}` with no remaining hooks, delete `hooks.json`.
4. Remove the managed gitignore stanza when present (idempotent match on the comment header):

   ```gitignore
   # Clockify MCP — personal time-tracking (delete this block to share with the team)
   .clockify/
   .cursor/rules/clockify-time.mdc
   ```

## Do not

- Wipe unrelated Cursor hooks or rules
- Delete the user’s entire `.gitignore`
- Uninstall Directory / local plugin or clear `CLOCKIFY_API_KEY` unless asked
- Invent paths outside the well-known set above

## After

Summarize what was removed and note that Clockify MCP may still be available at the user/plugin level for manual tracking without project config.
