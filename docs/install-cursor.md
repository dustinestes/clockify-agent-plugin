<br><br>
<img align="right" src="../assets/logo.svg" height="40" alt="Clockify Agent Plugin">
<h1>Install for Cursor</h1>
<br clear="both">

One-time machine setup: MCP tools + Agent Skills. Per-repo setup: [`/clockify-init`](use.md) (includes workspace picker).

<br>

## Recommended: install script

```bash
npx -y -p @dustinestes/clockify-agent-plugin clockify-cursor-install
```

This writes **user-global** Cursor config:

| What | Where |
|------|--------|
| Skills (`clockify-*`) | `~/.cursor/skills/` (symlinks into the npm package) |
| MCP server | `~/.cursor/mcp.json` → `clockify-agent-plugin` via npx |
| API key | Prompted, or `--api-key` / `CLOCKIFY_API_KEY` env |

Workspace ID is **not** set at install time. Each repo chooses a Clockify workspace during `/clockify-init` (stored in `.clockify/config.yml`). User MCP does not pin `CLOCKIFY_CONFIG_ROOT`; skills pass `config_root` ([config.md](./config.md#which-repo-config_root)).

### Options

```bash
clockify-cursor-install --help                 # usage
clockify-cursor-install --dry-run              # show planned changes, write nothing
clockify-cursor-install --uninstall            # remove symlinks + MCP entry
clockify-cursor-install --sandbox              # maintainer: temp repo → checkout dist/
clockify-cursor-install --sandbox --teardown   # remove that temp repo
```

From a plugin checkout: `npm run install:cursor`

### Maintainer sandbox

Play against this checkout’s `dist/` in a disposable temp repo. Does **not** rewrite `~/.cursor/mcp.json`.

```bash
npm run build
npm run install:cursor -- --sandbox
npm run install:cursor -- --sandbox --teardown
```

Open the printed `$TMPDIR` path in a separate Cursor window. See [develop.md](./develop.md#sandbox).

### After install

1. Reload Cursor (**Developer: Reload Window**).
2. **Customize → MCP** — enable `clockify-agent-plugin`.
3. Optional: [pre-allow MCP tools](use.md#pre-enable-clockify-tools).
4. In each repo: `/clockify-init`.

---

<br>

## cursor.directory (optional)

Directory lists MCP and skills separately:

- **MCP Add to Cursor** — installs one stdio server only (no skills). Fill in your API key manually; do not set workspace ID there.
- **Skills** — Copy only (no install button today).

Use the install script above for the full bundle. Directory is useful for discovery; it is not a full plugin marketplace install.

Requires a recent Cursor (MCP deeplink install dialog works on 3.15+).

---

<br>

## Manual MCP only

Add to `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "clockify-agent-plugin": {
      "command": "npx",
      "args": ["-y", "@dustinestes/clockify-agent-plugin"],
      "env": {
        "CLOCKIFY_API_KEY": "your_key_here"
      }
    }
  }
}
```

Copy skills manually: symlink or copy each `skills/clockify-*` folder into `~/.cursor/skills/`.

---

<br>

---

<strong>Clockify Agent Plugin</strong>
<div align="right">

[MIT License](../LICENSE)

</div>
<br clear="both">
