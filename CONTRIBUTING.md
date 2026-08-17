# Contributing

Thanks for wanting to work on the unofficial **Clockify Agent Plugin**.

## Use vs change

- **Use it:** [README](README.md) and [docs/getting-started.md](docs/getting-started.md).
- **Change this repo:** [docs/develop.md](docs/develop.md) (`dev:link` / `dev:unlink` / sandbox).
- **Ship a version or Directory listing:** [docs/publish.md](docs/publish.md).

## Pull requests

1. Branch from `main`.
2. Keep subscriber docs (README, getting-started, config) separate from maintainer docs (develop, publish) unless a rename forces a link update.
3. Do not commit `.env`, API keys, or a `dev:link`-shaped `mcp.json`.
4. PR CI runs build, config tests, version check, and MCP handshake (no Clockify credentials).

Issues: [github.com/dustinestes/clockify-mcp-server/issues](https://github.com/dustinestes/clockify-mcp-server/issues).
