<br><br>
<img align="right" src="../assets/logo.svg" height="40" alt="Clockify MCP (unofficial)">
<h1>Develop</h1>
<br clear="both">

How to develop this MCP on a machine that may also act like a Marketplace subscriber. Explicit modes avoid false positives (green MCP that is really your checkout; skills missing because only MCP was wired).

<br>

## Contents

- [Contents](#contents)
- [Modes](#modes)
- [Developer mode](#developer-mode)
- [Consumer-like mode](#consumer-like-mode)
- [Sandbox](#sandbox)
- [Mental model](#mental-model)
- [See also](#see-also)

---

<br>

## Modes

| Mode | Purpose | How |
|------|---------|-----|
| **Developer** | Iterate this repo (tools + plugin skills) | `npm run dev:link` |
| **Consumer-like** | Behave like a Marketplace user on this machine | `npm run dev:unlink` |

```bash
npm run dev:status
```

After link or unlink: **reload Cursor**.

<br>

---

<br>

## Developer mode

`npm run dev:link`:

1. Symlinks this repo to `~/.cursor/plugins/local/clockify-dev` (not `clockify`, so Marketplace id does not collide)
2. Points repo `mcp.json` at local `node dist/index.js` for the local plugin
3. Writes **project** `.cursor/mcp.json` with server id **`clockify-dev`**
4. Removes local-dist Clockify entries from `~/.cursor/mcp.json`

```bash
npm run build
# reload Cursor
```

Verify: Plugins → `clockify-dev` (skills via `/`); MCP → `clockify-dev` green. This is not Marketplace proof.

<br>

---

<br>

## Consumer-like mode

`npm run dev:unlink`:

1. Removes `clockify-dev` / legacy `clockify` local plugin symlinks
2. Restores repo `mcp.json` to publish/npx shape (`mcp.publish.json`)
3. Clears this project's `.cursor/mcp.json`
4. Strips local-dist Clockify servers from `~/.cursor/mcp.json`

Reload, then install from Marketplace or configure npx as a subscriber would.

<br>

---

<br>

## Sandbox

Test skills/init without mutating this repo:

```bash
npm run sandbox           # ~/workspaces/clockify-mcp-sandbox
npm run sandbox:teardown
```

- Skills symlinked from this checkout
- MCP `clockify-dev` → this checkout's `dist` + `.env`
- `CLOCKIFY_CONFIG_ROOT` = the sandbox

Project MCP often starts **disabled** until you enable it under Customize → MCP.

<br>

---

<br>

## Mental model

```text
Marketplace subscriber     Developer on same machine
─────────────────────      ─────────────────────────
plugin id: clockify        plugin id: clockify-dev
mcp: npx or Marketplace    mcp: dist/ via clockify-dev
skills: from plugin        skills: from clockify-dev plugin
```

Do not keep a user-scoped MCP pointed at this checkout's `dist` while validating Marketplace install.

<br>

---

<br>

## See also

- [setup.md](./setup.md)
- [publish.md](./publish.md)
- [Docs index](./README.md)

<br>

---

<br>

<strong>Clockify MCP Server</strong>
<div align="right">

[MIT License](../LICENSE)

</div>
<br clear="both">
