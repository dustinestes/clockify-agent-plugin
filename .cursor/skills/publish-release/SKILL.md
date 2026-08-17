---
name: publish-release
description: >-
  Cut a GitHub Release that publishes @dustinestes/clockify-mcp-server to npm.
  Bumps package.json, plugin.json, and .cursor-plugin/plugin.json to the same
  version, then creates tag vX.Y.Z. Use when the user asks to publish a new
  version, cut a release, ship to npm, or create a GitHub Release for this
  package. Do not bump or tag unless they asked to publish.
---

# Publish a release

Source of truth: [docs/publish.md](../../../docs/publish.md).

## Do not start unless asked

Never bump versions, create tags, or open GitHub Releases unless the user asked to publish.

## Steps

1. Confirm `main` is the intended tree (docs / product work merged as requested).
2. `npm run dev:unlink` so committed `mcp.json` stays npx-shaped.
3. Bump the **same** version in `package.json` (and the lockfile), `plugin.json`, and `.cursor-plugin/plugin.json`. Tag will be `v` plus that version. Do not reuse a version already on npm (`0.1.0` is taken; first GitHub Release should be **0.2.0** or later).
4. `npm run check:versions`
5. Commit, open a PR if not already on `main`, merge.
6. After merge: `gh release create vX.Y.Z --generate-notes` (not a draft, not a prerelease). Do **not** create `v0.1.0`.
7. Wait for [`.github/workflows/publish.yml`](../../../.github/workflows/publish.yml). Verify `npm view @dustinestes/clockify-mcp-server version`.
8. Handshake: `npx -y @dustinestes/clockify-mcp-server` (stdio; idle until Ctrl+C).

## Owner-only (stop)

The agent cannot do these. Point at [docs/publish.md](../../../docs/publish.md) and wait.

- **npm Trusted Publisher** (one-time): npmjs.com → package → Trusted Publisher → GitHub Actions, workflow filename `publish.yml`.
- **cursor.directory**: first listing is the website form; later skill/catalog changes are **Edit**, never a second submit. No publisher API.

## Directory

Directory snapshots GitHub `HEAD` and ignores tags. Do not submit the first listing until npm `latest` matches this tree.
