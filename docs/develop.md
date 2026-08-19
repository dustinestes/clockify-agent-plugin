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
  - [Scripted](#scripted)
  - [Manual](#manual)
- [Publish](#publish)
- [Appendix](#appendix)
  - [Sandbox](#sandbox)
    - [Supported Commands and Parameters](#supported-commands-and-parameters)
  - [Test prompts](#test-prompts)
  - [MCP tools](#mcp-tools)

---

<br>

## Prerequisites

Also meet [Getting started](../README.md#getting-started) (Node 18+, Cursor, Clockify API key) prerequisites. Skip this section if this checkout already builds.

| Name | Description | Command |
|------|-------------|---------|
| Clone | Local checkout of this repo | `git clone https://github.com/dustinestes/clockify-agent-plugin.git` |
| npm install | Install dependencies (including TypeScript) | `npm install` |
| Checkout `.env` | API key for sandbox MCP (`envFile`) and `smoke:live`. The server does not auto-load `.env`. Consumers keep the key in user MCP env instead. | `printf 'CLOCKIFY_API_KEY=your_key_here\n' > .env` |

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

### Scripted

1. Create a fresh build: `npm run build`
2. Setup the [sandbox](#sandbox): `npm run install:cursor -- --sandbox`
3. Open Cursor: `cursor /tmp/clockify-agent-plugin-validation`.
4. Enable MCP server: `Customize → MCPs → clockify-agent-plugin`
5. Initialize git repo: `git init`
6. Initialize clockify-agent-plugin: `/clockify-init`
   - Choose a clockify workspace ID when prompted
7. Validate: `use test prompts or custom validation`
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

A disposable temp repo that points at this checkout’s `dist/`. It does **not** rewrite `~/.cursor/mcp.json` or this repo’s `mcp.json`.

- Created in the OS temp folder so it may vanish on reboot. Re-run `--sandbox` if the folder is gone.
- This is not a consumer install. Do not treat a green sandbox MCP as proof that npx / Directory works.

| Component | How it Works |
|------|--------|
| Skills | sandbox `.cursor/skills/` → this checkout’s `skills/` |
| MCP | sandbox `.cursor/mcp.json` → `dist/index.js` + checkout `.env` |
| Config | `CLOCKIFY_CONFIG_ROOT` = the sandbox ; see [config.md](./config.md)) |

<br>

#### Supported Commands and Parameters

Agent TODO: Fill in section

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

### MCP tools

The agent calls these; people use skills. Listed here for handshake tests and allowlists (`clockify-agent-plugin:*`). User-scoped MCP should pass `config_root` (git toplevel) on each call — [config.md](./config.md#which-repo-config_root).

| Tool | Purpose |
|------|---------|
| `clockify_get_config` | Effective `.clockify/config.yml` standards (miss payload includes `tried` paths) |
| `clockify_get_user` | Authenticated user + workspace IDs |
| `clockify_list_workspaces` | List workspaces |
| `clockify_list_projects` | List / filter projects |
| `clockify_ensure_project` | Find or create project by name |
| `clockify_list_tags` | List tags |
| `clockify_list_tasks` | List tasks on a project |
| `clockify_ensure_task` | Find or create task (e.g. GitHub label) |
| `clockify_get_running_timer` | Current running timer (+ inactivity hint) |
| `clockify_start_timer` | Start a timer (optional start time; description template fields) |
| `clockify_stop_timer` | Stop the running timer (optional rounding) |
| `clockify_create_time_entry` | Create a completed entry (explicit start/end; no rounding) |
| `clockify_list_time_entries` | List entries in a window |
| `clockify_today_summary` | Today's totals by project |

---

<br>

---

<strong>Clockify Agent Plugin</strong>
<div align="right">

[MIT License](../LICENSE)

</div>
<br clear="both">
