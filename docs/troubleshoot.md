<br><br>
<img align="right" src="../assets/logo.svg" height="40" alt="Clockify Agent Plugin">
<h1>Troubleshoot</h1>
<br clear="both">

Some troubleshooting steps for common issues.

<br>

## Contents

- [Contents](#contents)
- [Node not found](#node-not-found)
- [`.clockify/config.yml` not found](#clockifyconfigyml-not-found)
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

## `.clockify/config.yml` not found

`clockify_get_config` returns `found: false`, or start/stop/enter-time fail closed with a miss payload, even though `.clockify/config.yml` exists on disk.

User-scoped MCP does not run with the git repo as cwd. Skills must pass `config_root` (git toplevel). The miss payload includes `tried` (`config_root`, `CLOCKIFY_CONFIG_PATH`, `CLOCKIFY_CONFIG_ROOT`, `cwd`).

Check:

1. Pass `config_root` as the git toplevel (`git rev-parse --show-toplevel` from the working directory). If it is already known this session and still this repo, reuse it — do not run git before every tool. Open editor tabs are not required.
2. A leftover `CLOCKIFY_CONFIG_PATH` or `CLOCKIFY_CONFIG_ROOT` in **user** `~/.cursor/mcp.json` still wins (PATH) or pins every window to one repo (ROOT). Remove those from the user install; they belong to sandbox / an optional project overlay only.
3. If you have not run `/clockify-init` in this repo, the file really is missing.

Which path to pass in single-folder, multi-window, multi-root, and CLI layouts: [config.md — which repo](./config.md#which-repo-config_root). When to reuse vs re-resolve: [config.md — when to reuse](./config.md#when-to-reuse-config_root). Server search order: [config.md — discovery](./config.md#discovery).

---

<br>

## Common symptoms

| Symptom | Likely cause |
|---------|----------------|
| Server not listed under Customize → MCP | Unloaded path; invalid json; Node not on PATH |
| `CLOCKIFY_API_KEY is required` | Missing plugin / MCP `env` |
| `clockify_get_config` `found: false` but yaml exists | User MCP cwd is not the repo; missing `config_root` or leftover PATH/ROOT env — [config not found](#clockifyconfigyml-not-found) |
| Workspace ID not found | Typo in `.clockify/config.yml` `workspace_id`; re-run `/clockify-init` to pick a workspace |
| `npx -y @dustinestes/clockify-agent-plugin` fails | Node/npx not on PATH, or registry/network |
| Agent sits idle after the first Clockify tool call | Waiting on MCP tool approval; [pre-enable tools](./use.md#pre-enable-clockify-tools) |

---

<br>

<strong>Clockify Agent Plugin</strong>
<div align="right">

[MIT License](../LICENSE)

</div>
<br clear="both">
