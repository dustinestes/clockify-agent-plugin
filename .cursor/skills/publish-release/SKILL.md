---
name: publish-release
description: >-
  Cut a GitHub Release that publishes @dustinestes/clockify-agent-plugin to npm.
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
2. Confirm `.mcp.json` is still the unpinned npx shape (never a local `dist/` path).
3. Bump the **same** version in `package.json` (and the lockfile), `plugin.json`, and `.cursor-plugin/plugin.json`. Tag will be `v` plus that version. `@dustinestes/clockify-mcp-server@0.1.0` is leftover under the old npm name — do not republish it. First publish of `@dustinestes/clockify-agent-plugin` may be `0.1.0`.
4. `npm run check:versions`
5. Commit, open a PR if not already on `main`, merge.
6. After merge: `gh release create vX.Y.Z --generate-notes` (not a draft, not a prerelease).
7. Wait for [`.github/workflows/publish.yml`](../../../.github/workflows/publish.yml). Verify `npm view @dustinestes/clockify-agent-plugin version`.
8. Handshake: `npx -y @dustinestes/clockify-agent-plugin` (stdio; idle until Ctrl+C).

## Owner-only (stop)

The agent cannot do these. Point at [docs/publish.md](../../../docs/publish.md) and wait.

- **npm Trusted Publisher** (one-time): npmjs.com → package → Trusted Publisher → GitHub Actions, workflow filename `publish.yml`.
- **cursor.directory**: first listing is the website form; later skill/catalog changes are **Edit**, never a second submit. No publisher API.

## Directory

Directory snapshots GitHub `HEAD` and ignores tags. Do not submit the first listing until npm `latest` matches this tree.
