<br><br>
<img align="right" src="../assets/logo.svg" height="40" alt="Clockify Agent Plugin">
<h1>Config</h1>
<br clear="both">

How `.clockify/config.yml` gets on disk, how git treats it, and how the server finds it. Field contract: [schema/config.yml.md](./schema/config.yml.md).

<br>

## Contents

- [Contents](#contents)
- [Setup](#setup)
- [Git hygiene](#git-hygiene)
- [Discovery](#discovery)

---

<br>

## Setup

Preferred: `/clockify-init` in the repo (writes config, ignore defaults, Clockify project). Or copy by hand:

```bash
mkdir -p .clockify
cp path/to/clockify-agent-plugin/.clockify/config.yml.example .clockify/config.yml
```

Point the MCP server at the repo when Cursor's cwd is wrong:

```json
"env": {
  "CLOCKIFY_CONFIG_ROOT": "${workspaceFolder}"
}
```

Or set `CLOCKIFY_CONFIG_PATH` to the full path of the config file.

---

<br>

## Git hygiene

- **Default:** do not commit `.clockify/`. Init writes a directory self-ignore and a managed stanza in the repo `.gitignore`.
- **Team opt-in:** delete the managed ignore block and commit `.clockify/` on purpose if the team wants shared standards. Still never commit API keys.
- **Cursor glue:** `.cursor/rules/clockify-time.mdc` is also listed in the managed stanza when automated init is used. Other `.cursor/` files stay team-owned; do not ignore all of `.cursor/`.
- **Cleanup:** run `clockify-unautomate` to drop Cursor glue and keep config, or `clockify-uninit` for full local teardown.
- A global `core.excludesfile` can ignore Clockify files in every repo; it is an extra option, not a substitute for init’s repo-local default.

---

<br>

## Discovery

1. `CLOCKIFY_CONFIG_PATH` (explicit file), else
2. `.clockify/config.yml` under the project root

Project root is the git/workspace root (parent of `.clockify/`), not the `.clockify` directory itself.

---

<br>

<strong>Clockify Agent Plugin</strong>
<div align="right">

[MIT License](../LICENSE)

</div>
<br clear="both">
