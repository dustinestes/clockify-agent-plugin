<br><br>
<img align="right" src="../assets/logo.svg" height="40" alt="Clockify Agent Plugin">
<h1>Logging</h1>
<br clear="both">

How Clockify Agent Plugin MCP logs work: where they appear, how to set the level, and what each line means.

The MCP server speaks JSON-RPC on **stdout**. All plugin logs go to **stderr** as one JSON object per line so they never break the protocol.

<br>

## Contents

- [Contents](#contents)
- [Where to find logs](#where-to-find-logs)
- [Level (`CLOCKIFY_MCP_LOG`)](#level-clockify_mcp_log)
- [What to expect](#what-to-expect)
- [Cursor `[error]` on every line](#cursor-error-on-every-line)
- [How many Node processes](#how-many-node-processes)
- [Init and other “errors” that are expected](#init-and-other-errors-that-are-expected)
- [Secrets](#secrets)
- [Sandbox](#sandbox)

---

<br>

## Where to find logs

| Host | How |
|------|-----|
| Cursor | **View → Output**, then the **Select Log** dropdown. Consumer: a channel containing `clockify-agent-plugin`. Sandbox: `clockify-agent-plugin-sandbox` (Cursor may prefix `project-0-<folder>-`, so the name can look doubled). Also listed: **MCP Logs** / **MCP Process** (host spawn text, not plugin JSON). |
| Other stdio hosts | The process **stderr** stream (Claude Code / Desktop and generic stdio: whatever that host uses for MCP server logs). |

Reload the window after changing MCP `env` **only if** Cursor actually respawns Node (see [How many Node processes](#how-many-node-processes)). If `ps` still shows `dist/index.js`, disable the MCP toggle or kill that process, then enable it again so it loads a new `dist/`.

---

<br>

## Level (`CLOCKIFY_MCP_LOG`)

Set in the MCP server `env` (user `~/.cursor/mcp.json`, project `.cursor/mcp.json`, or plugin variables). The process does **not** read repo `.env`.

| Value | What you get |
|-------|----------------|
| `info` (default) | Start/ready, each tool start/end, handled tool errors, stdin close (when the host actually closes the stream) |
| `debug` | Everything in `info`, plus Clockify HTTP method/path/status/duration (no headers or bodies) |
| `error` | Failures only: API/tool errors, uncaught exceptions, HTTP transport throws |
| `off` | Silence (not recommended while diagnosing) |

Unknown values fall back to `info`.

Example:

```json
"env": {
  "CLOCKIFY_API_KEY": "…",
  "CLOCKIFY_MCP_LOG": "debug"
}
```

---

<br>

## What to expect

Each line is JSON. Common fields: `ts` (ISO-8601), `level`, `msg`. Extra fields depend on `msg`.

| `msg` | Level | Meaning |
|-------|-------|---------|
| `ready` | info | Process started (`pid`, `version`, `log`, `transport: stdio`) |
| `connected` | info | MCP stdio transport connected |
| `tool_start` | info | Host invoked a tool (`tool`) |
| `tool_end` | info or error | Tool returned. `status`: `success` (completed), `warning` (`reason`: `config_miss` or `overlap`), `fail` (`reason`: `error` recognized payload, `unparsed` non-JSON text, `empty` no body; `level: error`, plus `message` when present) |
| `clockify_http_error` | error | Clockify REST returned 4xx/5xx (`status` is the HTTP code, `method`, `path`, `message`) |
| `tool_throw` | error | Handler threw (unexpected) |
| `http` | debug | Clockify REST call (`method`, `path`, `status` = HTTP code, `ms`) |
| `http_throw` | error | `fetch` failed (network / DNS / TLS) |
| `stdin_end` / `stdin_close` | info | Host closed stdin. On Cursor this often **never appears**: stdio is a Unix socket that stays connected after the MCP toggle goes red. |
| `uncaughtException` / `unhandledRejection` | error | Process-level failure |
| `fatal` | error | Startup failed; process exits `1` |

Healthy tool call at `info`:

```json
{"ts":"2026-08-22T04:10:01.000Z","level":"info","msg":"tool_start","tool":"clockify_get_user"}
{"ts":"2026-08-22T04:10:01.200Z","level":"info","msg":"tool_end","tool":"clockify_get_user","status":"success","ms":198}
```

Init before yaml exists (fail-closed write tools). Cursor may paint the MCP tool as an error; the JSON is `expected: true`:

```json
{"level":"info","msg":"tool_end","tool":"clockify_ensure_project","status":"warning","expected":true,"reason":"config_miss","tried":{}}
```

### Cursor `[error]` on every line

Cursor’s Output channel **MCP Process** / **Shared MCP process** prefixes **every stderr line** with `[error]`, including successful tools. That prefix is the host’s stream label (MCP protocol uses stdout for JSON-RPC; logs must use stderr). Trust the JSON fields `level` and `status`, not the `[error]` tag.

Typical host wrapping (this is a successful GET; `status` here is the HTTP code):

```text
2026-08-23 10:22:16.401 [error] [Shared MCP process] {"level":"debug","msg":"http","method":"GET","path":"/user","status":200}
 undefined
```

The trailing `undefined` is the host logger (an extra format argument), not a plugin field. A real plugin failure has `"level":"error"` inside the JSON (`clockify_http_error`, `tool_end` with `status: "fail"`, `tool_throw`, `fatal`).

### How many Node processes

Each **enabled** MCP server id should have **one** `node …/dist/index.js` (or `npx` child) process.

Two processes is correct when **both** user `clockify-agent-plugin` and sandbox `clockify-agent-plugin-sandbox` are enabled (different ids). Two processes with the **same** id, or a process whose cwd is `(deleted)` after sandbox teardown, is a leftover: Cursor can show the toggle as disabled without killing Node (see below). A reboot clears those. Before a clean sandbox respawn:

```bash
ps aux | grep clockify-agent-plugin/dist/index.js | grep -v grep
```

Kill extras if the same command line appears more than once per server.

**Disable then enable does not start a new process** if Node is still alive. Cursor keeps the stdio Unix sockets open when the toggle goes red, then reattaches. `ps` `START` / elapsed time will not change. **Reload Window** is the same: the process already has `dist/` in memory.

To load a new build: wait until `ps` shows **no** `dist/index.js` (or `kill` that pid), *then* enable the server. A few seconds after disable is usually not enough.

### Init and other “errors” that are expected

`/clockify-init` often probes tools **before** `.clockify/config.yml` exists. Write tools then return MCP `isError` with a config-miss payload. Chat can still succeed after the file is written. In plugin JSON, those lines are `tool_end` with `expected: true` and `reason: config_miss` (not a crash). Real API failures are `clockify_http_error` plus `tool_end` with `expected: false` and a `message`.

### Toggle red, Output quiet after `ready`

Cursor can mark the MCP **disabled** and stop appending to that Output channel while the Node process is **still running**. stdin/stdout stay connected (Unix sockets). There is no `stdin_close`, nothing in **MCP Process**, and no crash. Confirm with:

```bash
ps aux | grep clockify-agent-plugin/dist/index.js | grep -v grep
```

That is host UI/session state, not a plugin exception. Reload Window may keep the old process; after sandbox teardown you can also be left with a process whose cwd is `(deleted)`. Kill leftover `dist/index.js` processes if you need a clean spawn.

If `ps` shows **no** process and Output has `uncaughtException` / `fatal`, that is a real plugin crash — include those JSON lines when reporting.

---

<br>

## Secrets

Logs never include `CLOCKIFY_API_KEY`, request headers, or response bodies. HTTP debug logs use path + status only. Do not paste MCP config JSON that still contains your API key when sharing logs.

---

<br>

## Sandbox

Maintainer sandbox (see [develop.md](./develop.md#sandbox)) writes `CLOCKIFY_MCP_LOG=debug` into the temp `.cursor/mcp.json`. In the **sandbox window**, Output → the channel whose name includes **`clockify-agent-plugin-sandbox`**.

After `src/` changes: `npm run build`, then **stop the MCP process** (`ps` must show none) and enable the sandbox server again. **Developer: Reload Window** is not enough if Node is still running.

---

<br>

---

<strong>Clockify Agent Plugin</strong>
<div align="right">

[MIT License](../LICENSE)

</div>
<br clear="both">
