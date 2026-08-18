# Contributing

Thanks for wanting to work on the unofficial **Clockify Agent Plugin**.

## Use vs change

- **Use it:** [README](README.md) and [docs/use.md](docs/use.md).
- **Change this repo:** [docs/develop.md](docs/develop.md) (build + `--sandbox`; consumer install via `clockify-cursor-install`).
- **Ship a version or Directory listing:** [docs/publish.md](docs/publish.md).

## Pull requests

1. Branch from `main`.
2. Keep subscriber docs (README, use, troubleshoot, config, schema) separate from maintainer docs (develop, publish) unless a rename forces a link update.
3. Do not commit `.env` or API keys. Leave `mcp.json` as the unpinned npx shape.
4. PR CI runs build, config tests, version check, and MCP handshake (no Clockify credentials).

Issues: [github.com/dustinestes/clockify-agent-plugin/issues](https://github.com/dustinestes/clockify-agent-plugin/issues).
