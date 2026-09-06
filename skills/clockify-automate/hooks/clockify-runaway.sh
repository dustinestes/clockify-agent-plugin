#!/usr/bin/env bash
# Clockify Agent Plugin — runaway ceiling check (owned entry).
# Installed by /clockify-automate when entry.automated.runaway.enabled is true.
# Removed by /clockify-unautomate (and when runaway is disabled on re-run).
# Fail-open: never block coding if Clockify/MCP is down or this script errors.

set -u

fail_open() {
  printf '%s\n' '{}'
  exit 0
}

trap fail_open EXIT

input="$(cat 2>/dev/null || true)"
event="$(
  printf '%s' "$input" | sed -n 's/.*"hook_event_name"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -n 1
)"

case "$event" in
  sessionStart)
    # Instruct the agent; do not call Clockify from this process.
    printf '%s\n' '{"additional_context":"Clockify runaway: call clockify_get_running_timer with config_root (git toplevel / folder root). If runaway.pastCeiling is true, AskQuestion — keep running, stop and cap (runaway_stop: true), or stop at now. Do not silently stop. Fail open if Clockify is unavailable."}'
    ;;
  sessionEnd|stop|*)
    printf '%s\n' '{}'
    ;;
esac

trap - EXIT
exit 0
