/**
 * Fast checks for config helpers (no Clockify API).
 */
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  applyDescriptionTemplate,
  applyRoundingToInterval,
  clockifyConfigSchema,
  findProjectRoot,
  isTimerPastInactivity,
  loadClockifyConfig,
  projectRootFromConfigPath,
  resolveConfigPathInRoot,
  resolveProjectName,
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

const sampleYaml = `version: 1
project:
  name_from: fixed
  name: FixtureRepo
`;

function withFixture(run: (dir: string) => void): void {
  const dir = mkdtempSync(join(tmpdir(), "clockify-config-"));
  const prevPath = process.env.CLOCKIFY_CONFIG_PATH;
  const prevRoot = process.env.CLOCKIFY_CONFIG_ROOT;
  delete process.env.CLOCKIFY_CONFIG_PATH;
  delete process.env.CLOCKIFY_CONFIG_ROOT;
  try {
    run(dir);
  } finally {
    if (prevPath === undefined) delete process.env.CLOCKIFY_CONFIG_PATH;
    else process.env.CLOCKIFY_CONFIG_PATH = prevPath;
    if (prevRoot === undefined) delete process.env.CLOCKIFY_CONFIG_ROOT;
    else process.env.CLOCKIFY_CONFIG_ROOT = prevRoot;
    rmSync(dir, { recursive: true, force: true });
  }
}

withFixture((dir) => {
  mkdirSync(join(dir, ".clockify"), { recursive: true });
  writeFileSync(join(dir, ".clockify", "config.yml"), sampleYaml);
  const loaded = loadClockifyConfig(dir);
  assert.equal(loaded.found, true);
  assert.equal(loaded.path, join(dir, ".clockify", "config.yml"));
  assert.equal(loaded.root, dir);
  assert.equal(resolveProjectName(loaded.config, loaded.root), "FixtureRepo");
  assert.equal(resolveConfigPathInRoot(dir), loaded.path);
});

withFixture((dir) => {
  mkdirSync(join(dir, ".clockify"), { recursive: true });
  const configPath = join(dir, ".clockify", "config.yml");
  writeFileSync(configPath, sampleYaml);
  process.env.CLOCKIFY_CONFIG_PATH = configPath;
  const loaded = loadClockifyConfig("/tmp");
  assert.equal(loaded.found, true);
  assert.equal(loaded.path, configPath);
  assert.equal(loaded.root, dir);
  assert.equal(projectRootFromConfigPath(configPath), dir);
});

withFixture((dir) => {
  mkdirSync(join(dir, "nested", "deep"), { recursive: true });
  mkdirSync(join(dir, ".clockify"), { recursive: true });
  writeFileSync(join(dir, ".clockify", "config.yml"), sampleYaml);
  assert.equal(findProjectRoot(join(dir, "nested", "deep")), dir);
});

withFixture((dir) => {
  mkdirSync(join(dir, ".git"));
  assert.equal(findProjectRoot(dir), dir);
  assert.equal(resolveConfigPathInRoot(dir), null);
  const loaded = loadClockifyConfig(dir);
  assert.equal(loaded.found, false);
  assert.equal(loaded.root, dir);
});

console.log("OK: config unit checks");
