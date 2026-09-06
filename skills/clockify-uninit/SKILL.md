---
name: clockify-uninit
description: >-
  Remove Clockify integration artifacts from a consumer repo: .clockify/,
  clockify rule, Clockify-owned hooks, and the managed gitignore stanza.
  Use when uninstalling repo Clockify standards. To keep config and only turn
  off agent mode, use clockify-unautomate instead. Does not uninstall the
  Clockify Agent Plugin unless the user asks.
disable-model-invocation: true
---

# Clockify uninit

Full local teardown of Clockify-owned files in a **consumer** repo. Confirm with the user before deleting.

If they only want to stop agent-mediated timers and **keep** `.clockify/config.yml`, stop and run [`clockify-unautomate`](../clockify-unautomate/SKILL.md) instead.

## Confirm

1. Inventory with tools if needed, then **repeat the result in a normal chat message** the user can read without opening tool output. Use a short markdown list of **paths that exist** (and optionally “not found” for expected paths). Tool snippets / terminals are not the inventory.
2. That chat list is the confirm surface: unautomate paths plus `.clockify/`, the remaining gitignore stanza, and `.gitignore` itself if removing the stanza would leave the file empty. Note that the Clockify Agent Plugin stays installed unless they ask otherwise.
3. If `.clockify/.managed-by-init` is missing, still include those well-known paths in the chat inventory (user may have edited by hand).
4. Then AskQuestion with **only** a short confirm, e.g. “Remove Clockify files from this repo?” — do **not** put the inventory in the question box, and do **not** skip the chat list.
5. Do **not** uninstall the Clockify Agent Plugin unless the user explicitly asks.

## Removals

Perform [`clockify-unautomate`](../clockify-unautomate/SKILL.md) first (rule + Clockify-owned hooks + rule gitignore line), then:

1. Delete `.clockify/` entirely (config, marker, self-ignore, any extras).
2. Remove the remaining managed gitignore stanza when present (idempotent match on either comment header):

   ```gitignore
   # Clockify Agent Plugin — personal time-tracking (delete this block to share with the team)
   .clockify/
   ```

   Also match the older header `# Clockify MCP — personal time-tracking` if a repo was inited before the rename.

   If the stanza still lists the rule path or `.cursor/hooks/clockify-runaway.sh` (unautomate not run yet), remove those lines together.

3. After stanza removal: if `.gitignore` is empty or whitespace-only, delete the file (same idea as deleting empty `hooks.json` in unautomate). If any other ignore rules remain, keep the file. Never delete a non-empty `.gitignore`. No need to know whether init created the file — emptiness after our stanza is gone is enough.

## Do not

- Wipe unrelated Cursor hooks or rules
- Delete a non-empty `.gitignore` (empty / whitespace-only after stanza removal is OK — see above)
- Uninstall Directory / local plugin or clear `CLOCKIFY_API_KEY` unless asked
- Invent paths outside the well-known set above
- Treat tool output as the user-visible inventory (always restate paths in chat before AskQuestion)

## After

Summarize what was removed. The Clockify Agent Plugin may still be available at the user/plugin level. Repo yaml is gone until they run `clockify-init` again.
