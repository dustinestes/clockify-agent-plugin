<br><br>
<img align="right" src="../assets/logo.svg" height="40" alt="Clockify MCP (unofficial)">
<h1>Publish</h1>
<br clear="both">

npm and Cursor Marketplace submission for this unofficial connector.

<br>

## Contents

- [Contents](#contents)
- [npm](#npm)
- [Cursor Marketplace](#cursor-marketplace)
- [GitHub topics](#github-topics)
- [See also](#see-also)

---

<br>

## npm

Repo `mcp.json` for publish must use npx (see `mcp.publish.json`). `npm run dev:unlink` restores that shape; `npm run dev:link` rewrites `mcp.json` for local plugin testing.

```json
{
  "mcpServers": {
    "clockify": {
      "command": "npx",
      "args": ["-y", "clockify-mcp-server"],
      "env": {
        "CLOCKIFY_API_KEY": "${CLOCKIFY_API_KEY}",
        "CLOCKIFY_WORKSPACE_ID": "${CLOCKIFY_WORKSPACE_ID}"
      }
    }
  }
}
```

```bash
npm run dev:unlink
npm run build
npm login
npm publish --access public
```

Verify `npx -y clockify-mcp-server` starts over stdio.

<br>

---

<br>

## Cursor Marketplace

1. Push this repo public on GitHub
2. Development plugin id is `clockify-dev` (`npm run dev:link`). For a clean subscriber check use `npm run dev:unlink`, reload, then install from Marketplace
3. Listing copy must state this is an **unofficial** third-party connector (not affiliated with Clockify/Cake.com). Display name **Clockify**; plugin id `clockify`
4. Optional: email Cursor Marketplace about owner/accreditation display before submit
5. Submit at https://cursor.com/marketplace/publish
6. Optional: https://cursor.directory

<br>

---

<br>

## GitHub topics

`mcp` `model-context-protocol` `clockify` `cursor-plugin` `agent-skills` `time-tracking`

<br>

---

<br>

## See also

- [develop.md](./develop.md)
- [Docs index](./README.md)

<br>

---

<br>

<strong>Clockify MCP Server</strong>
<div align="right">

[MIT License](../LICENSE)

</div>
<br clear="both">
