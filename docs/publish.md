<br><br>
<img align="right" src="../assets/logo.svg" height="40" alt="Clockify MCP (unofficial)">
<h1>Publish</h1>
<br clear="both">

npm and [cursor.directory](https://cursor.directory) for this unofficial connector. Listing title is **Clockify**; npm package stays `@dustinestes/clockify-mcp-server`.

Agent: [`.cursor/skills/publish-release`](../.cursor/skills/publish-release/SKILL.md) (maintainer only; not a Directory skill).

<br>

## Contents

- [Contents](#contents)
- [npm](#npm)
- [Release](#release)
- [Trusted publishing](#trusted-publishing)
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

Pull requests and pushes to `main` run `npm ci`, `npm run build`, `npm run test:config`, `npm run check:versions`, and `npm run smoke:handshake` with no Clockify credentials. Handshake only checks MCP `initialize` against `dist/`; it does not call the Clockify API. That workflow does not publish. Do not publish on every push to `main`.

<br>

---

<br>

## Release

One shared version: `package.json`, `plugin.json`, and `.cursor-plugin/plugin.json` (and the lockfile). GitHub Release tag is `v` plus that version (`v0.2.0`). `npm run check:versions` fails closed if they drift; on the publish job it also requires the tag to match.

`0.1.0` is already on npm from a manual publish. Do **not** create GitHub Release `v0.1.0`. First CI publish must be a **new** version (recommend **0.2.0**).

1. `npm run dev:unlink` so committed `mcp.json` stays npx-shaped.
2. Bump the three manifests (and lockfile) together. Merge to `main`.
3. `gh release create vX.Y.Z --generate-notes` (not a draft, not a prerelease).
4. [`.github/workflows/publish.yml`](../.github/workflows/publish.yml) runs on `release: published`: build, config tests, handshake, version check, `npm publish --access public` via OIDC. Verify `npm view @dustinestes/clockify-mcp-server version`.
5. Confirm `npx -y @dustinestes/clockify-mcp-server` starts over stdio.

Do not auto-bump on merge. Do not publish from tag-push alone (a tag without a published Release does nothing).

<br>

---

<br>

## Trusted publishing

npm publish authenticates with GitHub Actions OIDC (no `NPM_TOKEN` secret). One-time on [npmjs.com](https://www.npmjs.com/package/@dustinestes/clockify-mcp-server) → package **Settings** → **Trusted Publisher**:

| Field | Value |
|-------|--------|
| Provider | GitHub Actions |
| Organization or user | `dustinestes` |
| Repository | `clockify-mcp-server` |
| Workflow filename | `publish.yml` (filename only) |
| Environment | leave empty |
| Allowed actions | `npm publish` |

Configure this **before** the first GitHub Release. Provenance is generated automatically for public packages from this workflow.

After the first CI publish succeeds, optionally restrict token publishing on the package (**Require two-factor authentication and disallow tokens**). Manual `npm publish` from a laptop then stops working; that is intended.

<br>

---

<br>

## Cursor Directory

One-time submit after the repo is public and npm `latest` matches `main` (skills on GitHub `HEAD` would otherwise pair with stale MCP tools):

1. `npm run dev:unlink` so committed `mcp.json` stays npx-shaped. Confirm `.mcp.json` is still the publish/npx shape (never a local `dist/` path).
2. Development plugin id is `clockify-dev` (`npm run dev:link`). For a clean subscriber check use `npm run dev:unlink`, reload, then install from Directory or wire npx.
3. Listing copy must state this is an **unofficial** third-party connector (not affiliated with Clockify/Cake.com). Public title **Clockify**; plugin id `clockify`. On the submit form, override auto-fill `clockify` if the name field is lowercase.
4. Submit at [cursor.directory/plugins/new](https://cursor.directory/plugins/new): sign in, paste `https://github.com/dustinestes/clockify-mcp-server`. Directory auto-detects `.mcp.json` and `skills/*/SKILL.md`. It does **not** pick up `.cursor/skills/` (maintainer skills).
5. Wait for the automated safety scan (`safe`). The listing appears when it passes.

Directory does not read git tags or semver. It snapshots components from GitHub at parse time. There is no publisher API for CI.

<br>

---

<br>

## After the first listing

Do **not** submit a second listing for the same repo (duplicate name/repo is rejected).

| Change | What to ship |
|--------|----------------|
| MCP tools (`src/`) | GitHub Release → npm (unpinned npx). Skip Directory. |
| New/removed skills, skill titles, mcp command shape, logo, listing copy | Merge to `main`, then **Edit** the existing Directory listing so it re-parses GitHub `HEAD`. |
| First listing | Website form above. Owner-only; the agent cannot submit. |

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
