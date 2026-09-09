<br><br>
<img align="right" src="../assets/logo.svg" height="40" alt="Clockify Agent Plugin">
<h1>Develop</h1>
<br clear="both">

How to change this plugin. Edit and build in this checkout. Validate against those changes in a disposable [sandbox](#sandbox). Test a consumer install with the same script subscribers use.

<br>

## Contents

- [Contents](#contents)
- [Prerequisites](#prerequisites)
- [Build](#build)
- [Validate](#validate)
  - [Run and Debug](#run-and-debug)
  - [CLI](#cli)
  - [Manual](#manual)
- [Publish](#publish)
- [Appendix](#appendix)
  - [Sandbox](#sandbox)
    - [Supported Commands and Parameters](#supported-commands-and-parameters)
    - [What Sandbox Does](#what-sandbox-does)
  - [Test prompts](#test-prompts)

---

<br>

## Prerequisites

Also meet [Getting started](../README.md#getting-started) (Node 18+, Cursor, Clockify API key) prerequisites. Skip this section if this checkout already builds.

**Maintainer tooling** (CI / publish / local install of this repo): **Node 22.22.3+** (npm 12 needs `^22.22.2`; avoid Actions toolcache **22.22.2**, which ships a broken bundled npm) and **npm 12.0.2** (`packageManager` in `package.json`). Prefer Corepack (`corepack enable npm && corepack prepare npm@12.0.2 --activate`) over `npm install -g`. Consumer runtime for the published package remains Node 18+.

| Name | Description | Command |
|------|-------------|---------|
| Clone | Local checkout of this repo | `git clone https://github.com/dustinestes/clockify-agent-plugin.git` |
| npm install | Install dependencies (including TypeScript). npm 12 blocks dependency install scripts unless listed in `allowScripts` (this repo already allows `esbuild` / `fsevents`). | `npm install` |
| Checkout `.env` | Optional `CLOCKIFY_API_KEY_SANDBOX` seed for sandbox MCP / `smoke:live`. Copied into sandbox mcp.json at create time. The MCP server does not read `.env`. Do not put consumer `CLOCKIFY_API_KEY` here. | See [`.env.example`](../.env.example) |

Pin the Clockify workspace ID in each test repo’s `.clockify/config.yml` (via `/clockify-init`), not in this checkout’s `.env`.

---

<br>

## Build

Update the compiled files into `dist/` and `node_modules/`. These folders are referenced by the validation and sandbox operations to test locally before shipping changes. 

> After `src/` changes: build again, then reload the window that is running the sandbox MCP.

```bash
npm run build
```


---

<br>

## Validate

Test changes against local `dist/` without pushing to GitHub, publishing to npm, or cutting a release.

### Run and Debug

Builds, creates the temp sandbox, opens it in a new Cursor/VS Code window when `cursor` or `code` is on `PATH`, and keeps a dedicated debug terminal alive until **Stop** or Ctrl+C. Closing or **Developer: Reload Window** in the sandbox editor does **not** tear down the temp folder (reload is how you pick up MCP / build changes).

1. Open Code/Cursor Run and Debug panel
2. Select launch configuration: `Sandbox`
3. Click: `Start Debugging` or press: `F5`
4. In the sandbox window: **Developer: Reload Window** if needed, then enable **`clockify-agent-plugin-sandbox`** under Customize → MCPs (leave user **`clockify-agent-plugin`** disabled in that window). Open **Output → MCP Logs** ([logging.md](./logging.md)); sandbox sets `CLOCKIFY_MCP_LOG=debug`.
5. Validate build: `use test prompts or custom validation`
6. Tear down with **Stop** (always deletes the folder via `postDebugTask` — no prompt; the session is already ending), or Ctrl+C in the debug terminal (confirms; answer `n` to keep the folder and stay attached). Or run **Sandbox: teardown** / `npm run sandbox:teardown`.

<br>

> Note: **Stop** sends SIGTERM (`killBehavior: polite`), the script exits cleanly, then the force-teardown task deletes the sandbox folder and SIGTERMs leftover Node tagged `CLOCKIFY_MCP_SANDBOX=1`. It does **not** close the editor window (no safe shared-instance close API). Close any leftover window yourself after teardown.
>
> Closing the debug terminal tab alone is not a reliable cleanup hook — use **Stop**, Ctrl+C, or **Sandbox: teardown**.

### CLI

1. Create a fresh build: `npm run build`
2. Optional: set `CLOCKIFY_API_KEY_SANDBOX` in checkout `.env` (see [`.env.example`](../.env.example))
3. Setup the [sandbox](#sandbox): `npm run install:cursor -- --sandbox`
4. Open Cursor: `cursor -n /tmp/clockify-agent-plugin-sandbox/`.
5. Enable MCP server: `Customize → MCPs → clockify-agent-plugin-sandbox` (leave user `clockify-agent-plugin` off in this window). If the key was not seeded, hand-fill `env.CLOCKIFY_API_KEY` in sandbox `.cursor/mcp.json`. Logs: [logging.md](./logging.md) (**Output → MCP Logs**).
6. Initialize plugin: `/clockify-init`
   - Choose a Clockify workspace when prompted (base yaml only; no project ensure)
7. Optional: `/clockify-automate` for forge + Cursor platforms
8. Validate build: `use test prompts or custom validation`
9. Tear down the [sandbox](#sandbox): `npm run install:cursor -- --sandbox --teardown`

### Manual

Use this only if you will not run the scripted validation setup. Pointing **user** MCP at `dist/` affects **every** Cursor window until you revert it.

1. Create a fresh build: `npm run build`
2. Edit user-scope `~/.cursor/mcp.json` and merge this into `mcpServers` (replace the path and key):

    ```json
    "clockify-agent-plugin": {
      "command": "node",
      "args": [
        "/path/to/repo/clockify-agent-plugin/dist/index.js"
      ],
      "env": {
        "CLOCKIFY_API_KEY": "insert_your_key_here"
      }
    }
    ```

3. Reload Cursor: `Command Palette → Developer: Reload Window`
4. Enable MCP server: `Customize → MCPs → clockify-agent-plugin`
5. Create temp folder: `mkdir /tmp/clockify-agent-plugin-validation`
6. Open Cursor: `cursor /tmp/clockify-agent-plugin-validation`.
7. Initialize git repo: `git init`
8. Initialize clockify-agent-plugin: `/clockify-init`
   - Choose a Clockify workspace when prompted (base yaml only; no project ensure)
9. Optional: `/clockify-automate` for forge + Cursor platforms
10. Copy skills into that repo or rely on user-global skills if you already have them. User MCP does not install this checkout’s `skills/` for you.
11. Validate: `use test prompts or custom validation`
12. Delete `/tmp/clockify-agent-plugin-validation`
13. Revert user-scope `~/.cursor/mcp.json` to the published npx entry, or remove `clockify-agent-plugin` entirely

---

<br>

## Publish

When the change is ready to ship: 

- Meet [publish prerequisites](./publish.md#prerequisites)
- Read [publish.md](./publish.md)  

---

<br>

## Appendix

### Sandbox

A disposable temp repo that points at this checkout’s `dist/`. It does **not** rewrite `~/.cursor/mcp.json` or this repo’s `.mcp.json`.

**One sandbox at a time.** There is a single path (`$TMPDIR/clockify-agent-plugin-sandbox`) and a single tagged MCP (`CLOCKIFY_MCP_SANDBOX=1` → this checkout’s `dist/index.js`). `--sandbox` **runs the same teardown** as `--sandbox --teardown` (remove the folder, then SIGTERM tagged Node), then creates. That is the contract: you do not get a teardown plan on create, and you do not keep a previous sandbox yaml/`dist/` in memory. Do not treat extra sandbox windows as parallel test environments. User `npx` `clockify-agent-plugin` is separate and is not killed. `--sandbox --dry-run` prints the create plan only and does not tear down.

- Created in the OS temp folder so it may vanish on reboot. Re-run `--sandbox` if the folder is gone.
- This is not a consumer install. Do not treat a green sandbox MCP as proof that npx / Directory works.
- Cursor may show the sandbox MCP as disabled while `node …/dist/index.js` is still running ([logging.md](./logging.md#toggle-red-output-quiet-after-ready)). Teardown (including the teardown `--sandbox` runs first) deletes the folder then reaps processes tagged `CLOCKIFY_MCP_SANDBOX=1`.
- After `npm run build`, Stop or teardown so that process is gone (Reload Window is not enough) so the next enable loads new `dist/` ([logging.md](./logging.md#how-many-node-processes)).

| Component | How it Works |
|------|--------|
| Skills | sandbox `.cursor/skills/` → this checkout’s `skills/` |
| MCP | sandbox `.cursor/mcp.json` → **`clockify-agent-plugin-sandbox`** → `dist/index.js`; `CLOCKIFY_API_KEY` baked from checkout `.env` `CLOCKIFY_API_KEY_SANDBOX` (or empty for hand-fill); `CLOCKIFY_MCP_LOG=debug`; `CLOCKIFY_MCP_SANDBOX=1` (reap tag) |
| Config | `CLOCKIFY_CONFIG_ROOT` = the sandbox ; see [config.md](./config.md)) |

<br>

#### Supported Commands and Parameters

From this checkout: `npm run install:cursor -- {invocation}` 

> Equivalent: `clockify-install-cursor {invocation}` with the same flags.

| Invocation | What it does |
|------------|----------------|
| `--sandbox` | Tear down any existing sandbox, then create the temp repo at `$TMPDIR/clockify-agent-plugin-sandbox` |
| `--sandbox --dry-run` | Print the create plan only; write nothing (does not tear down) |
| `--sandbox --teardown` | Delete the temp repo, then SIGTERM tagged sandbox MCP |
| `--sandbox --teardown --dry-run` | Print the teardown plan; write nothing |
| `--help` | Usage for the whole install script (including sandbox) |

Related npm scripts (wrappers only; same flags underneath):

| Script | What it does |
|--------|----------------|
| `npm run sandbox:debug` | Build, `--sandbox`, open editor, keep-alive until Stop/Ctrl+C for Run and Debug → **Sandbox** |
| `npm run sandbox:teardown` | Confirm, then `--sandbox --teardown` |
| `npm run sandbox:teardown -- --force` | Same without prompt (used after debug **Stop**) |

<br>

#### What Sandbox Does

1. Tear down any existing sandbox (same steps as `--sandbox --teardown`: folder + tagged MCP). Create does not print a teardown plan.
2. Create `$TMPDIR/clockify-agent-plugin-sandbox`
3. `git init` in that folder
4. Symlink each `skills/clockify-*` from this checkout into the sandbox `.cursor/skills/`
5. Write sandbox `.cursor/mcp.json` under server id **`clockify-agent-plugin-sandbox`** (stdio `node` + this checkout’s `dist/index.js`, `CLOCKIFY_API_KEY` from checkout `.env` `CLOCKIFY_API_KEY_SANDBOX` or `""`, `CLOCKIFY_CONFIG_ROOT` = the sandbox, `CLOCKIFY_MCP_SANDBOX=1`). No `envFile`.
6. Write a short sandbox `README.md`

> `--sandbox` does **not** change `~/.cursor/mcp.json`, `~/.cursor/skills/`, or this repo’s `.mcp.json`. 
> 
> `--sandbox --teardown` deletes the entire temp folder. Close or reload any Cursor window that had it open. Clockify data already written in your Clockify workspace is not undone.

---

<br>

### Test prompts

```
# Test Timer
/clockify-start-timer [optional params]
/clockify-stop-timer [optional params]

# Test Manual Entry
/clockify-enter-time [start/end] [optional params]

# Test Automated
/clockify-automate
# Start work that would hit one of the triggers configured in config.yml
/clockify-automate-disable
/clockify-automate-enable
/clockify-unautomate

# Test Status and Summarizer
/clockify-status
/clockify-summarize
```

---

<br>

---

<strong>Clockify Agent Plugin</strong>
<div align="right">

[MIT License](../LICENSE)

</div>
<br clear="both">
