/**
 * Fast checks for config helpers (no Clockify API).
 */
import assert from "node:assert/strict";
import {
  applyDescriptionTemplate,
  applyRoundingToInterval,
  clockifyConfigSchema,
  isTimerPastInactivity,
  roundDate,
} from "../src/config.js";

const cfg = clockifyConfigSchema.parse({
  version: 1,
  rounding: { enabled: true, increment_minutes: 15, mode: "nearest" },
  description: { template: "{issue_number} {issue_title}" },
  automation: {
    triggers: [{ event: "issue_start", action: "start_timer" }],
    inactivity: { enabled: true, stop_after_minutes: 45 },
  },
});
assert.equal(cfg.rounding.increment_minutes, 15);

assert.equal(
  applyDescriptionTemplate(cfg.description.template, {
    issue_number: 42,
    issue_title: "Login bug",
  }),
  "#42 Login bug",
);

const d = new Date("2026-08-09T19:07:00.000Z");
const nearest = roundDate(d, 15, "nearest");
assert.equal(nearest.toISOString(), "2026-08-09T19:00:00.000Z");

const rounded = applyRoundingToInterval(
  "2026-08-09T18:02:00.000Z",
  "2026-08-09T19:07:00.000Z",
  cfg.rounding,
);
assert.equal(rounded.applied, true);
assert.equal(rounded.start, "2026-08-09T18:00:00.000Z");
assert.equal(rounded.end, "2026-08-09T19:00:00.000Z");

const started = new Date(Date.now() - 50 * 60 * 1000).toISOString();
assert.equal(
  isTimerPastInactivity(started, cfg.automation.inactivity),
  true,
);

console.log("OK: config unit checks");
