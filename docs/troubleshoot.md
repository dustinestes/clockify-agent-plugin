<br><br>
<img align="right" src="../assets/logo.svg" height="40" alt="Clockify Agent Plugin">
<h1>Troubleshoot</h1>
<br clear="both">

Some troubleshooting steps for common issues.

<br>

## Contents

- [Contents](#contents)
- [Node not found](#node-not-found)
- [Common symptoms](#common-symptoms)

---

<br>

## Node not found

Cursor launched from a desktop entry often has a minimal PATH, so `"command": "npx"` can fail.

```bash
command -v node   # use the absolute path in MCP config if needed
```

After changing config, reload Cursor. If MCP is red, open **Output → MCP Logs**.

---

<br>

## Common symptoms

| Symptom | Likely cause |
|---------|----------------|
| Server not listed under Customize → MCP | Unloaded path; invalid json; Node not on PATH |
| `CLOCKIFY_API_KEY is required` | Missing plugin / MCP `env` |
| Workspace ID not found | Typo in config.yml `workspace_id` or `CLOCKIFY_WORKSPACE_ID` |
| `npx -y @dustinestes/clockify-agent-plugin` fails | Node/npx not on PATH, or registry/network |
| Agent sits idle after the first Clockify tool call | Waiting on MCP tool approval; [pre-enable tools](./use.md#pre-enable-clockify-tools) |

---

<br>

<strong>Clockify Agent Plugin</strong>
<div align="right">

[MIT License](../LICENSE)

</div>
<br clear="both">
