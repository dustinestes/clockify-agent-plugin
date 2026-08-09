<br><br>
<img align="right" src="../assets/logo.svg" height="40" alt="Clockify MCP (unofficial)">
<h1>Setup</h1>
<br clear="both">

Install and configure the unofficial Clockify MCP for Cursor and other hosts. Marketplace happy path lives in the [root README](../README.md); this page covers credentials, clones, PATH issues, and alternatives.

<br>

## Contents

- [Contents](#contents)
- [Credentials](#credentials)
- [Develop this repo](#develop-this-repo)
- [Node not found](#node-not-found)
- [envFile vs env](#envfile-vs-env)
- [Other MCP hosts](#other-mcp-hosts)
- [Troubleshooting](#troubleshooting)
- [See also](#see-also)

---

<br>

## Credentials

Same values for every host. Details also summarized in the root README.

**`CLOCKIFY_API_KEY` (required)** — Clockify → Preferences → Advanced → Manage API Keys.

**`CLOCKIFY_WORKSPACE_ID` (optional)** — pin a workspace via `/workspaces/{id}/` in the URL, or `clockify_list_workspaces`.

```bash
cp .env.example .env
# edit .env
```

Per-repo standards (`.clockify.yml`): [config.md](./config.md).

<br>

---

<br>

## Develop this repo

Use explicit developer vs consumer-like modes so local paths do not fake a Marketplace install — see [develop.md](./develop.md).

```bash
cp .env.example .env
npm install
npm run build
npm run dev:link
# reload Cursor — enable plugin clockify-dev; use MCP clockify-dev
npm run smoke:handshake
npm run smoke:live     # optional
```

```bash
npm run sandbox           # ~/workspaces/clockify-mcp-sandbox
npm run sandbox:teardown
```

`dev:link` writes project `.cursor/mcp.json` as **`clockify-dev`** (this workspace only). Do not put local `dist/index.js` in `~/.cursor/mcp.json` while validating consumer installs.

<br>

---

<br>

## Node not found

Cursor launched from a desktop entry often has a minimal PATH, so `"command": "node"` or `"npx"` can fail.

```bash
command -v node   # use the absolute path in mcp.json if needed
```

After changing config, reload Cursor. If MCP is red, open **Output → MCP Logs**.

Quick stdio check:

```bash
set -a && source .env && set +a
node dist/index.js
# idle on stdio; Ctrl+C to stop
```

<br>

---

<br>

## envFile vs env

| Approach | When to use |
|----------|-------------|
| `envFile` → `.env` | Local clone; keeps secrets out of json |
| `env` block in `mcp.json` | Published/`npx` install; hosts without `envFile` |

A repo `.env` is not loaded automatically by the server. Without `envFile` or `env`, tools fail with “CLOCKIFY_API_KEY is required”.

<br>

---

<br>

## Other MCP hosts

### Claude Code / Desktop

```json
{
  "command": "npx",
  "args": ["-y", "@dustinestes/clockify-mcp-server"],
  "env": {
    "CLOCKIFY_API_KEY": "your_key_here"
  }
}
```

```bash
mkdir -p ~/.claude/skills
cp -R skills/clockify-coding-time ~/.claude/skills/
```

### Generic stdio host

Same as Claude once published, or absolute `node` + `dist/index.js` while developing.

<br>

---

<br>

## Troubleshooting

| Symptom | Likely cause |
|---------|----------------|
| Server not listed under Customize → MCP | Unloaded path; invalid json; Node not on PATH |
| `CLOCKIFY_API_KEY is required` | Missing `env` / `envFile` |
| Workspace ID not found | Typo in `CLOCKIFY_WORKSPACE_ID` |
| `npx -y @dustinestes/clockify-mcp-server` fails | Not published yet, or PATH issue |

<br>

---

<br>

## See also

- [develop.md](./develop.md) - local plugin modes
- [publish.md](./publish.md) - npm and Marketplace
- [Docs index](./README.md)
- [Clockify API](https://docs.clockify.me)

<br>

---

<br>

<strong>Clockify MCP Server</strong>
<div align="right">

[MIT License](../LICENSE)

</div>
<br clear="both">
