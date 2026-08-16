<br><br>
<img align="right" src="../assets/logo.svg" height="40" alt="Clockify MCP (unofficial)">
<h1>Publish</h1>
<br clear="both">

npm and [cursor.directory](https://cursor.directory) for this unofficial connector. Listing title is **Clockify**; npm package stays `@dustinestes/clockify-mcp-server`.

<br>

## Contents

- [Contents](#contents)
- [npm](#npm)
- [Cursor Directory](#cursor-directory)
- [After the first listing](#after-the-first-listing)
- [GitHub topics](#github-topics)
- [See also](#see-also)

---

<br>

## npm

This is what Directory users actually run. Keep `.mcp.json` and `mcp.publish.json` **unpinned** (`npx -y @dustinestes/clockify-mcp-server`, no `@1.2.3`) so each Cursor start resolves latest npm.

`dev:link` rewrites repo `mcp.json` for local plugin testing. It must not touch `.mcp.json`. `npm run dev:unlink` restores `mcp.json` from `mcp.publish.json` before you commit or publish.

```json
{
  "mcpServers": {
    "clockify": {
      "command": "npx",
      "args": ["-y", "@dustinestes/clockify-mcp-server"],
      "env": {
        "CLOCKIFY_API_KEY": "${CLOCKIFY_API_KEY}",
        "CLOCKIFY_WORKSPACE_ID": "${CLOCKIFY_WORKSPACE_ID}"
      }
    }
  }
}
```

Bump `version` together in `package.json`, `plugin.json`, and `.cursor-plugin/plugin.json`, then tag `vX.Y.Z` to match. Pre-1.0 can still break.

```bash
npm run dev:unlink
npm run build
npm login
npm publish --access public
```

Verify `npx -y @dustinestes/clockify-mcp-server` starts over stdio.

Pull requests and pushes to `main` run `npm ci`, `npm run build`, `npm run test:config`, and `npm run smoke:handshake` with no Clockify credentials. Handshake only checks MCP `initialize` against `dist/`; it does not call the Clockify API. That workflow does not publish.

Until a Release workflow exists ([#15](https://github.com/dustinestes/clockify-mcp-server/issues/15)), publish npm by hand. Do not publish on every push to `main`.

<br>

---

<br>

## Cursor Directory

One-time submit after the repo is public and npm is published:

1. `npm run dev:unlink` so committed `mcp.json` stays npx-shaped. Confirm `.mcp.json` is still the publish/npx shape (never a local `dist/` path).
2. Development plugin id is `clockify-dev` (`npm run dev:link`). For a clean subscriber check use `npm run dev:unlink`, reload, then install from Directory or wire npx.
3. Listing copy must state this is an **unofficial** third-party connector (not affiliated with Clockify/Cake.com). Public title **Clockify**; plugin id `clockify`. On the submit form, override auto-fill `clockify` if the name field is lowercase.
4. Submit at [cursor.directory/plugins/new](https://cursor.directory/plugins/new): sign in, paste `https://github.com/dustinestes/clockify-mcp-server`. Directory auto-detects `.mcp.json` and `skills/*/SKILL.md`.
5. Wait for the automated safety scan (`safe`). The listing appears when it passes.

Directory does not read git tags or semver. It snapshots components from GitHub at parse time.

<br>

---

<br>

## After the first listing

Do **not** submit a second listing for the same repo (duplicate name/repo is rejected).

| Change | What to ship |
|--------|----------------|
| MCP tools (`src/`) | npm publish (unpinned npx). Skip Directory. |
| New/removed skills, skill titles, mcp command shape, logo, listing copy | Merge to `main`, then **Edit** the existing Directory listing so it re-parses GitHub `HEAD`. |
| First listing | Website form above. There is no publisher API for CI. |

People who already clicked Add still have the old skill snapshot until they Add again (or clone). MCP tools update on the next `npx` start after npm publish.

This repo ships skills + MCP. Init writes a rule into the *consumer* repo; there is no plugin-root `rules/*.mdc`, so Directory will not show a Rules Add button.

<br>

---

<br>

## GitHub topics

`mcp` `model-context-protocol` `clockify` `cursor-plugin` `agent-skills` `time-tracking`

<br>

---

<br>

## See also

- [develop.md](./develop.md)
- [Docs index](./README.md)

<br>

---

<br>

<strong>Clockify MCP Server</strong>
<div align="right">

[MIT License](../LICENSE)

</div>
<br clear="both">
