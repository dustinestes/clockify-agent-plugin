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

| Name | Description | Command |
|------|-------------|---------|
| Clone | Local checkout of this repo | `git clone https://github.com/dustinestes/clockify-agent-plugin.git` |
| npm install | Install dependencies (including TypeScript) | `npm install` |
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
4. In the sandbox window: **Developer: Reload Window** if needed, then enable **`clockify-agent-plugin-sandbox`** under Customize → MCPs (leave user **`clockify-agent-plugin`** disabled in that window)
5. Validate build: `use test prompts or custom validation`
6. Tear down with **Stop** (always deletes the folder via `postDebugTask` — no prompt; the session is already ending), or Ctrl+C in the debug terminal (confirms; answer `n` to keep the folder and stay attached). Or run **Sandbox: teardown** / `npm run sandbox:teardown`.

<br>

> Note: **Stop** sends SIGTERM (`killBehavior: polite`), the script exits cleanly, then the force-teardown task deletes the sandbox folder. It does **not** close the editor window (no safe shared-instance close API). Close any leftover window yourself after teardown.
>
> Closing the debug terminal tab alone is not a reliable cleanup hook — use **Stop**, Ctrl+C, or **Sandbox: teardown**.

### CLI

1. Create a fresh build: `npm run build`
2. Optional: set `CLOCKIFY_API_KEY_SANDBOX` in checkout `.env` (see [`.env.example`](../.env.example))
3. Setup the [sandbox](#sandbox): `npm run install:cursor -- --sandbox`
4. Open Cursor: `cursor -n /tmp/clockify-agent-plugin-sandbox/`.
5. Enable MCP server: `Customize → MCPs → clockify-agent-plugin-sandbox` (leave user `clockify-agent-plugin` off in this window). If the key was not seeded, hand-fill `env.CLOCKIFY_API_KEY` in sandbox `.cursor/mcp.json`.
6. Initialize plugin: `/clockify-init`
   - Choose a clockify workspace ID when prompted
7. Validate build: `use test prompts or custom validation`
8. Tear down the [sandbox](#sandbox): `npm run install:cursor -- --sandbox --teardown`

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
   - Choose a clockify workspace ID when prompted
9. Copy skills into that repo or rely on user-global skills if you already have them. User MCP does not install this checkout’s `skills/` for you.
10. Validate: `use test prompts or custom validation`
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

- Created in the OS temp folder so it may vanish on reboot. Re-run `--sandbox` if the folder is gone.
- This is not a consumer install. Do not treat a green sandbox MCP as proof that npx / Directory works.

| Component | How it Works |
|------|--------|
| Skills | sandbox `.cursor/skills/` → this checkout’s `skills/` |
| MCP | sandbox `.cursor/mcp.json` → **`clockify-agent-plugin-sandbox`** → `dist/index.js`; `CLOCKIFY_API_KEY` baked from checkout `.env` `CLOCKIFY_API_KEY_SANDBOX` (or empty for hand-fill) |
| Config | `CLOCKIFY_CONFIG_ROOT` = the sandbox ; see [config.md](./config.md)) |

<br>

#### Supported Commands and Parameters

From this checkout: `npm run install:cursor -- {invocation}` 

> Equivalent: `clockify-install-cursor {invocation}` with the same flags.

| Invocation | What it does |
|------------|----------------|
| `--sandbox` | Create or refresh the temp repo at `$TMPDIR/clockify-agent-plugin-sandbox` |
| `--sandbox --dry-run` | Print the create plan; write nothing |
| `--sandbox --teardown` | Delete the temp repo |
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

1. Create `$TMPDIR/clockify-agent-plugin-sandbox` if missing
2. `git init` in that folder if it has no `.git`
3. Symlink each `skills/clockify-*` from this checkout into the sandbox `.cursor/skills/`
4. Write sandbox `.cursor/mcp.json` under server id **`clockify-agent-plugin-sandbox`** (stdio `node` + this checkout’s `dist/index.js`, `CLOCKIFY_API_KEY` from checkout `.env` `CLOCKIFY_API_KEY_SANDBOX` or `""`, `CLOCKIFY_CONFIG_ROOT` = the sandbox). No `envFile`.
5. Write a short sandbox `README.md`

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
