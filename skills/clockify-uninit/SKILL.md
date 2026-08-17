---
name: clockify-uninit
description: >-
  Remove Clockify integration artifacts from a consumer repo: .clockify/,
  clockify-time rule, Clockify-owned hooks, and the managed gitignore stanza.
  Use when uninstalling repo Clockify standards. To keep config and only turn
  off agent mode, use clockify-unautomate instead. Does not uninstall the
  Clockify Agent Plugin unless the user asks.
disable-model-invocation: true
---

# Clockify uninit

Full local teardown of Clockify-owned files in a **consumer** repo. Confirm with the user before deleting.

If they only want to stop agent-mediated timers and **keep** `.clockify/config.yml`, stop and run [`clockify-unautomate`](../clockify-unautomate/SKILL.md) instead.

## Confirm

1. Summarize what will be removed (unautomate paths plus `.clockify/` and the remaining gitignore stanza).
2. If `.clockify/.managed-by-init` is missing, still offer to remove the same well-known paths after explicit confirmation (user may have edited by hand).
3. Do **not** uninstall the Clockify Agent Plugin unless the user explicitly asks.

## Removals

Perform [`clockify-unautomate`](../clockify-unautomate/SKILL.md) first (rule + Clockify-owned hooks + rule gitignore line), then:

1. Delete `.clockify/` entirely (config, marker, self-ignore, any extras).
2. Remove the remaining managed gitignore stanza when present (idempotent match on either comment header):

   ```gitignore
   # Clockify Agent Plugin — personal time-tracking (delete this block to share with the team)
   .clockify/
   ```

   Also match the older header `# Clockify MCP — personal time-tracking` if a repo was inited before the rename.

   If the stanza still lists the rule path (unautomate not run yet), remove those lines together.

## Do not

- Wipe unrelated Cursor hooks or rules
- Delete the user’s entire `.gitignore`
- Uninstall Directory / local plugin or clear `CLOCKIFY_API_KEY` unless asked
- Invent paths outside the well-known set above

## After

Summarize what was removed. The Clockify Agent Plugin may still be available at the user/plugin level. Repo yaml is gone until they run `clockify-init` again.
