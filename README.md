<br><br>

<p align="center">
  <img src="assets/lockup-light.svg#gh-light-mode-only" alt="Clockify Agent Plugin" height="64">
  <img src="assets/lockup-dark.svg#gh-dark-mode-only" alt="Clockify Agent Plugin" height="64">
</p>

<br>

<p align="center">
  <img src="https://img.shields.io/badge/status-pre--release-2F4A34?style=flat-square&labelColor=2A2620" alt="Pre-release">
  <img src="https://img.shields.io/badge/stack-TypeScript%20%2F%20MCP-2F4A34?style=flat-square&labelColor=2A2620" alt="TypeScript / MCP">
  <img src="https://img.shields.io/badge/license-MIT-2F4A34?style=flat-square&labelColor=2A2620" alt="MIT">
</p>

<br>

---

Unofficial agent plugin for [Clockify](https://clockify.me): [MCP](https://modelcontextprotocol.io) tools plus Agent Skills — start/stop timers, enter time, and summarize sessions in Cursor and other MCP hosts.

**Not affiliated with, endorsed by, or sponsored by Clockify or Cake.com.** Third-party connector only.

---

<br>

## Getting started

### Install the plugin (once per machine)

1. Create a Clockify API key (Preferences → Advanced → Manage API Keys).
2. Run **`npx -y -p @dustinestes/clockify-agent-plugin clockify-cursor-install`** — installs skills + global MCP ([docs/install-cursor.md](docs/install-cursor.md)). Optional: Directory MCP button (MCP only; [caveats](docs/install-cursor.md#cursordirectory-optional)).
3. Reload Cursor; confirm **Customize → MCP** shows **clockify-agent-plugin** enabled.
4. Optional: [pre-allow Clockify MCP tools](docs/use.md#pre-enable-clockify-tools) so agents do not stall on an Allow / Always allow prompt mid-run.

Credentials, allowlists, and non-Cursor hosts: [docs/use.md](docs/use.md).

### Add Clockify to a repo (each repo)

1. In that repo, run `/clockify-init` — choose Clockify workspace, write config, ignore, Clockify project, optional GitHub label→task sync. After this you can enter time with skills (start/stop timer, enter-time, summarize).
2. Optional: run `/clockify-automate` so the agent starts/stops timers from `automated.triggers` (issues/PRs).

To undo a repo without uninstalling the plugin: [docs/use.md](docs/use.md#remove-clockify-from-a-repo).

---

<br>

## How it works

Two modes. Both use the same Clockify project. Clockify still allows only **one running timer**.

| Mode | How time gets in | Skills |
|------|------------------|--------|
| **Manual** | You (or the agent, when you ask) start/stop a timer or log a completed range | After `/clockify-init`: start-timer, stop-timer, enter-time, status, summarize |
| **Automated** | Agent follows Cursor rules/hooks from `automated.triggers` (issue/PR events in session) | `/clockify-automate` on; `/clockify-unautomate` back to manual |

---

<br>

## Skills

You talk to the agent in plain language (or run a `/skill`). The agent calls MCP tools; you do not.

> Setup skills (`init`, `uninit`, `automate`, `unautomate`) are slash-only so they do not fire by accident.

| Group | Skill | Purpose | Example |
|-------|-------|---------|---------|
| Repo | [`clockify-init`](skills/clockify-init/SKILL.md) | Setup the current working directory (config + ignore + project + GitHub label→task sync) | `/clockify-init` |
| Repo | [`clockify-uninit`](skills/clockify-uninit/SKILL.md) | Full local teardown (keep plugin unless asked) | `/clockify-uninit` |
| Mode | [`clockify-automate`](skills/clockify-automate/SKILL.md) | Agent mode on: Cursor rules/hooks from `automated.triggers` | `/clockify-automate` |
| Mode | [`clockify-unautomate`](skills/clockify-unautomate/SKILL.md) | Agent mode off: remove rule/hooks; keep `.clockify/` | `/clockify-unautomate` |
| Timer | [`clockify-start-timer`](skills/clockify-start-timer/SKILL.md) | Start a running timer (`entry_method: timer`) | `/clockify-start-timer` or “start a timer on this issue” |
| Timer | [`clockify-stop-timer`](skills/clockify-stop-timer/SKILL.md) | Stop the running timer | `/clockify-stop-timer` or “stop my Clockify timer” |
| Timer | [`clockify-status`](skills/clockify-status/SKILL.md) | Read-only running timer (or none) | `/clockify-status` or “is a timer running?” |
| Time | [`clockify-enter-time`](skills/clockify-enter-time/SKILL.md) | Completed range, no rounding (`entry_method: manual`) | `/clockify-enter-time` or “log 2–3pm on this issue” |
| Review | [`clockify-summarize`](skills/clockify-summarize/SKILL.md) | Today / range totals | `/clockify-summarize` or “how much time today?” |

---

<br>

## Developing

Working on this repo: [docs/develop.md](docs/develop.md). Shipping a release or Directory listing: [docs/publish.md](docs/publish.md). How to contribute: [CONTRIBUTING.md](CONTRIBUTING.md).

---

<br>

<strong>Clockify Agent Plugin</strong>
<div align="right">

[MIT License](LICENSE)

</div>
<br clear="both">
