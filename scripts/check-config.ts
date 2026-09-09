/**
 * Fast checks for config helpers (no Clockify API).
 */
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";
import {
  applyDescriptionTemplate,
  applyRoundingToInterval,
  applyStopRounding,
  clockifyConfigSchema,
  completedOverlaps,
  defaultConfig,
  findProjectRoot,
  floorToMinute,
  gapFitStart,
  intervalsOverlap,
  isAutomationConfigured,
  isAutomationPaused,
  isTimerPastRunawayCeiling,
  runawayCeilingEndIso,
  latestCompletedEnd,
  listCursorModeTasksToEnsure,
  loadClockifyConfig,
  onStartUsesLabel,
  overlapShouldProceed,
  parseClockifyConfig,
  prepareStartInstant,
  projectRootFromConfigPath,
  resolveConfiguredWorkspaceId,
  resolveConfigPathInRoot,
  resolveCursorModeBlock,
  resolveEntryDescription,
  resolveProjectName,
  resolveRepoName,
  roundDate,
  templateUsesLabel,
} from "../src/config.js";

const cfg = clockifyConfigSchema.parse({
  scope: { workspace_id: "ws_test" },
  entry: {
    timer: {
      rounding: {
        enabled: true,
        increment_minutes: 15,
        start_mode: "nearest",
        stop_mode: "nearest",
      },
    },
    automated: {
      enabled: true,
      forge: { github: { enabled: true } },
      triggers: [{ event: "issue_start", action: "start_timer" }],
      settings: {
        runaway: { enabled: true, stop_after_minutes: 45 },
        on_start: {
          description: {
            from: "template",
            template: "{issue_number} - {issue_title}",
          },
        },
      },
    },
  },
});
assert.equal(cfg.plugin.version, 4);
assert.equal(cfg.entry.timer.rounding.increment_minutes, 15);
assert.equal(
  cfg.entry.timer.description.template,
  "{issue_number} - {issue_title}",
);
assert.equal(cfg.entry.timer.description.from, "prompt");
assert.equal(cfg.entry.automated.settings.on_start.description.from, "template");
assert.equal(cfg.entry.timer.task.if_missing, "none");
assert.equal(cfg.entry.timer.task.from, "none");
assert.equal(cfg.entry.automated.settings.on_start.task.if_missing, "none");
assert.equal(cfg.entry.timer.overlap.on_conflict, "prompt");
assert.equal(cfg.scope.project.from, "local_folder");
assert.equal(defaultConfig().scope.project.from, "local_folder");
assert.equal(defaultConfig().scope.workspace_id, "unconfigured");
assert.equal(defaultConfig().entry.timer.task.from, "none");
assert.equal(defaultConfig().entry.automated.enabled, false);
assert.equal(defaultConfig().entry.automated.forge.github.enabled, false);
assert.deepEqual(defaultConfig().entry.automated.triggers, []);
assert.equal(isAutomationConfigured(defaultConfig()), false);
assert.equal(isAutomationConfigured(cfg), true);
assert.equal(isAutomationPaused(defaultConfig()), false);
assert.equal(isAutomationPaused(cfg), false);
assert.equal(
  isAutomationPaused(
    clockifyConfigSchema.parse({
      scope: { workspace_id: "ws_test" },
      entry: {
        automated: {
          enabled: false,
          forge: { github: { enabled: true } },
        },
      },
    }),
  ),
  true,
);

assert.equal(
  applyDescriptionTemplate(cfg.entry.timer.description.template, {
    issue_number: 42,
    issue_title: "Login bug",
  }),
  "#42 - Login bug",
);

assert.equal(
  resolveEntryDescription(cfg.entry.timer.description, {
    issue_number: 42,
    issue_title: "Login bug",
  }),
  undefined,
);
assert.equal(
  resolveEntryDescription(cfg.entry.automated.settings.on_start.description, {
    issue_number: 42,
    issue_title: "Login bug",
  }),
  "#42 - Login bug",
);
assert.equal(
  resolveEntryDescription(cfg.entry.timer.description, {
    description: "  Custom  ",
  }),
  "Custom",
);

assert.equal(
  applyDescriptionTemplate("#{issue_number} - {issue_title}", {
    issue_number: 1,
    issue_title: "Wire Clockify MCP",
  }),
  "##1 - Wire Clockify MCP",
);

assert.equal(
  applyDescriptionTemplate("{label} / {local_folder}", {
    label: "backend",
    local_folder: "clockify-agent-plugin",
  }),
  "backend / clockify-agent-plugin",
);
assert.equal(
  applyDescriptionTemplate("{github_label} / {repo}", {
    github_label: "backend",
    repo: "clockify-agent-plugin",
  }),
  "backend / clockify-agent-plugin",
);
assert.equal(templateUsesLabel("{label} work"), true);
assert.equal(templateUsesLabel("{github_label}"), true);
assert.equal(templateUsesLabel("{issue_title}"), false);
assert.equal(
  onStartUsesLabel({
    when_multiple_labels: "first",
    description: { from: "template", template: "{label}" },
    task: { from: "none", if_missing: "none" },
  }),
  true,
);
assert.equal(
  onStartUsesLabel({
    when_multiple_labels: "first",
    description: { from: "prompt", template: "{issue_number} - {issue_title}" },
    task: { from: "template", template: "{label}", if_missing: "create" },
  }),
  true,
);
assert.equal(
  onStartUsesLabel(defaultConfig().entry.automated.settings.on_start),
  false,
);

const cursorCfg = parseClockifyConfig({
  scope: { workspace_id: "ws_x" },
  entry: {
    automated: {
      platforms: {
        cursor: {
          enabled: true,
          modes: {
            agent: {
              enabled: true,
              task: { from: "fixed", name: "Agent", if_missing: "create" },
            },
            ask: {
              enabled: false,
              task: { from: "fixed", name: "Ask", if_missing: "create" },
            },
            plan: {
              enabled: true,
              task: { from: "none" },
            },
          },
        },
      },
    },
  },
});
assert.deepEqual(listCursorModeTasksToEnsure(cursorCfg), ["Agent"]);
assert.ok(resolveCursorModeBlock(cursorCfg, "agent"));
assert.equal(resolveCursorModeBlock(cursorCfg, "ask"), null);
assert.equal(resolveCursorModeBlock(defaultConfig(), "agent"), null);

const d = new Date("2026-08-09T19:07:00.000Z");
const nearest = roundDate(d, 15, "nearest");
assert.equal(nearest.toISOString(), "2026-08-09T19:00:00.000Z");

const rounded = applyRoundingToInterval(
  "2026-08-09T18:02:00.000Z",
  "2026-08-09T19:07:00.000Z",
  cfg.entry.timer.rounding,
);
assert.equal(rounded.applied, true);
assert.equal(rounded.start, "2026-08-09T18:00:00.000Z");
assert.equal(rounded.end, "2026-08-09T19:00:00.000Z");

const splitModes = applyRoundingToInterval(
  "2026-08-09T18:02:00.000Z",
  "2026-08-09T19:07:00.000Z",
  {
    ...cfg.entry.timer.rounding,
    start_mode: "down",
    stop_mode: "up",
  },
);
assert.equal(splitModes.start, "2026-08-09T18:00:00.000Z");
assert.equal(splitModes.end, "2026-08-09T19:15:00.000Z");

const collapsed = applyRoundingToInterval(
  "2026-08-09T18:07:00.000Z",
  "2026-08-09T18:08:00.000Z",
  cfg.entry.timer.rounding,
);
assert.equal(collapsed.start, "2026-08-09T18:00:00.000Z");
assert.equal(collapsed.end, "2026-08-09T18:15:00.000Z");

const billingFloor = applyRoundingToInterval(
  "2026-08-09T18:02:00.000Z",
  "2026-08-09T18:20:00.000Z",
  {
    ...cfg.entry.timer.rounding,
    minimum_minutes: 60,
  },
);
assert.equal(billingFloor.start, "2026-08-09T18:00:00.000Z");
assert.equal(billingFloor.end, "2026-08-09T19:00:00.000Z");

const started = new Date(Date.now() - 50 * 60 * 1000).toISOString();
assert.equal(
  isTimerPastRunawayCeiling(started, cfg.entry.automated.settings.runaway),
  true,
);

const sampleYaml = `plugin:
  version: 4
scope:
  workspace_id: ws_from_yaml
  project:
    from: fixed
    name: FixtureRepo
entry:
  timer:
    rounding:
      enabled: true
      increment_minutes: 15
      start_mode: nearest
      stop_mode: nearest
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
  assert.equal(resolveRepoName(loaded.root), basename(dir));
  assert.notEqual(resolveRepoName(loaded.root), "FixtureRepo");
  assert.equal(loaded.config.scope.workspace_id, "ws_from_yaml");
  assert.equal(
    resolveConfiguredWorkspaceId(loaded.config),
    "ws_from_yaml",
  );
  assert.equal(
    loaded.config.entry.timer.description.template,
    "{issue_number} - {issue_title}",
  );
  assert.equal(loaded.config.entry.timer.rounding.enabled, true);
  assert.equal(loaded.config.plugin.version, 4);
  assert.equal(resolveConfigPathInRoot(dir), loaded.path);
});

const leftoverNameFrom = parseClockifyConfig({
  scope: { workspace_id: "ws_x", project: { name_from: "fixed", name: "IgnoredKey" } },
});
assert.equal(leftoverNameFrom.scope.project.from, "local_folder");
assert.throws(
  () => parseClockifyConfig({ scope: { workspace_id: "  " } }),
  /workspace_id/,
);

assert.throws(
  () => parseClockifyConfig({ version: 1, workspace_id: "ws" }),
  /old root shape/,
);

assert.throws(
  () =>
    parseClockifyConfig({
      plugin_internal: { version: 2 },
      scope: { workspace_id: "ws_x" },
      entry_methods: {},
    }),
  /v2 keys \(plugin_internal \/ entry_methods\)/,
);

assert.throws(
  () =>
    parseClockifyConfig({
      plugin: { version: 2 },
      scope: { workspace_id: "ws_x" },
    }),
  /plugin\.version 2/,
);

const localFolderTaskCfg = parseClockifyConfig({
  scope: {
    workspace_id: "ws_x",
    project: { from: "fixed", name: "Application modernization" },
  },
  entry: {
    timer: { task: { from: "local_folder", if_missing: "create" } },
    manual: { task: { from: "local_folder", if_missing: "create" } },
    automated: {
      settings: {
        on_start: { task: { from: "local_folder", if_missing: "create" } },
      },
    },
  },
});
assert.equal(resolveRepoName(null), null);
assert.equal(localFolderTaskCfg.entry.timer.task.from, "local_folder");
assert.equal(localFolderTaskCfg.entry.manual.task.from, "local_folder");
assert.equal(
  localFolderTaskCfg.entry.automated.settings.on_start.task.from,
  "local_folder",
);
assert.throws(
  () =>
    parseClockifyConfig({
      scope: { workspace_id: "ws_x" },
      entry: { timer: { task: { from: "unknown" } } },
    }),
  /Invalid Clockify config/,
);
assert.throws(
  () =>
    parseClockifyConfig({
      scope: { workspace_id: "ws_x" },
      entry: { timer: { task: { from: "repo" } } },
    }),
  /repo is renamed to local_folder/,
);
assert.throws(
  () =>
    parseClockifyConfig({
      scope: { workspace_id: "ws_x" },
      entry: { timer: { task: { from: "github_label" } } },
    }),
  /github_label is removed/,
);
assert.throws(
  () =>
    parseClockifyConfig({
      scope: { workspace_id: "ws_x" },
      entry: {
        automated: {
          settings: { on_start: { task: { from: "repo" } } },
        },
      },
    }),
  /repo is renamed to local_folder/,
);

const manualPromptOnly = parseClockifyConfig({
  scope: { workspace_id: "ws_x" },
  entry: {
    manual: {
      description: { from: "prompt", template: "ignored leftover" },
    },
  },
});
assert.equal(manualPromptOnly.entry.manual.description.from, "prompt");
assert.equal(
  "template" in manualPromptOnly.entry.manual.description,
  false,
);
assert.throws(
  () =>
    parseClockifyConfig({
      scope: { workspace_id: "ws_x" },
      entry: { manual: { description: { from: "template" } } },
    }),
  /Invalid Clockify config/,
);

{
  // Paused automate: enabled false but forge/triggers/modes retained.
  const paused = parseClockifyConfig({
    scope: { workspace_id: "ws_x" },
    entry: {
      automated: {
        enabled: false,
        forge: { github: { enabled: true } },
        triggers: [{ event: "issue_start", action: "start_timer" }],
        platforms: {
          cursor: {
            enabled: false,
            modes: {
              plan: {
                enabled: true,
                triggers: [
                  { event: "start", action: "start_timer" },
                  { event: "stop", action: "stop_timer" },
                ],
                task: { from: "fixed", name: "agent_planning", if_missing: "create" },
              },
            },
          },
        },
      },
    },
  });
  assert.equal(paused.entry.automated.enabled, false);
  assert.equal(paused.entry.automated.forge.github.enabled, true);
  assert.equal(paused.entry.automated.triggers.length, 1);
  assert.equal(paused.entry.automated.platforms.cursor.enabled, false);
  assert.ok(paused.entry.automated.platforms.cursor.modes.plan);
}

assert.throws(
  () =>
    parseClockifyConfig({
      scope: { workspace_id: "ws_x" },
      entry: {
        automated: {
          enabled: true,
          forge: { github: { enabled: false } },
          triggers: [{ event: "issue_start", action: "start_timer" }],
        },
      },
    }),
  /forge triggers require an enabled forge/,
);

assert.throws(
  () =>
    parseClockifyConfig({
      scope: { workspace_id: "ws_x" },
      entry: {
        automated: {
          enabled: false,
          forge: { github: { enabled: false } },
          triggers: [{ event: "issue_start", action: "start_timer" }],
        },
      },
    }),
  /forge triggers require an enabled forge/,
);

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

withFixture((dir) => {
  mkdirSync(join(dir, ".clockify"), { recursive: true });
  writeFileSync(join(dir, ".clockify", "config.yml"), sampleYaml);
  const loaded = loadClockifyConfig("/tmp", { configRoot: dir });
  assert.equal(loaded.found, true);
  assert.equal(loaded.root, dir);
  assert.equal(loaded.config.scope.workspace_id, "ws_from_yaml");
});

withFixture((dir) => {
  const cwdDir = join(dir, "cwd-repo");
  const rootDir = join(dir, "arg-repo");
  mkdirSync(join(cwdDir, ".clockify"), { recursive: true });
  mkdirSync(join(rootDir, ".clockify"), { recursive: true });
  writeFileSync(
    join(cwdDir, ".clockify", "config.yml"),
    `plugin:\n  version: 4\nscope:\n  workspace_id: ws_from_cwd\n`,
  );
  writeFileSync(join(rootDir, ".clockify", "config.yml"), sampleYaml);
  const loaded = loadClockifyConfig(cwdDir, { configRoot: rootDir });
  assert.equal(loaded.found, true);
  assert.equal(loaded.root, rootDir);
  assert.equal(loaded.config.scope.workspace_id, "ws_from_yaml");
});

withFixture((dir) => {
  const envDir = join(dir, "env-repo");
  const argDir = join(dir, "arg-repo");
  mkdirSync(join(envDir, ".clockify"), { recursive: true });
  mkdirSync(join(argDir, ".clockify"), { recursive: true });
  writeFileSync(
    join(envDir, ".clockify", "config.yml"),
    `plugin:\n  version: 4\nscope:\n  workspace_id: ws_from_env\n`,
  );
  writeFileSync(join(argDir, ".clockify", "config.yml"), sampleYaml);
  process.env.CLOCKIFY_CONFIG_ROOT = envDir;
  const loaded = loadClockifyConfig("/tmp", { configRoot: argDir });
  assert.equal(loaded.found, true);
  assert.equal(loaded.root, argDir);
  assert.equal(loaded.config.scope.workspace_id, "ws_from_yaml");
  const fromEnv = loadClockifyConfig("/tmp");
  assert.equal(fromEnv.found, true);
  assert.equal(fromEnv.root, envDir);
  assert.equal(fromEnv.config.scope.workspace_id, "ws_from_env");
});

withFixture((dir) => {
  const pathDir = join(dir, "path-repo");
  const argDir = join(dir, "arg-repo");
  mkdirSync(join(pathDir, ".clockify"), { recursive: true });
  mkdirSync(join(argDir, ".clockify"), { recursive: true });
  const configPath = join(pathDir, ".clockify", "config.yml");
  writeFileSync(configPath, sampleYaml);
  writeFileSync(
    join(argDir, ".clockify", "config.yml"),
    `plugin:\n  version: 4\nscope:\n  workspace_id: ws_ignored_arg\n`,
  );
  process.env.CLOCKIFY_CONFIG_PATH = configPath;
  const loaded = loadClockifyConfig("/tmp", { configRoot: argDir });
  assert.equal(loaded.found, true);
  assert.equal(loaded.root, pathDir);
  assert.equal(loaded.config.scope.workspace_id, "ws_from_yaml");
});

withFixture((dir) => {
  const repoA = join(dir, "repo-a");
  const repoB = join(dir, "repo-b");
  mkdirSync(join(repoA, ".clockify"), { recursive: true });
  mkdirSync(join(repoB, ".clockify"), { recursive: true });
  writeFileSync(
    join(repoA, ".clockify", "config.yml"),
    `plugin:\n  version: 4\nscope:\n  workspace_id: ws_repo_a\n`,
  );
  writeFileSync(
    join(repoB, ".clockify", "config.yml"),
    `plugin:\n  version: 4\nscope:\n  workspace_id: ws_repo_b\n`,
  );
  const loadedA = loadClockifyConfig("/tmp", { configRoot: repoA });
  const loadedB = loadClockifyConfig("/tmp", { configRoot: repoB });
  assert.equal(loadedA.found, true);
  assert.equal(loadedB.found, true);
  assert.equal(loadedA.config.scope.workspace_id, "ws_repo_a");
  assert.equal(loadedB.config.scope.workspace_id, "ws_repo_b");
});

const examplePath = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  ".clockify",
  "config.yml.example",
);
const exampleCfg = clockifyConfigSchema.parse(
  parseYaml(readFileSync(examplePath, "utf8")),
);
assert.equal(exampleCfg.plugin.version, 4);
assert.equal(exampleCfg.scope.project.from, "local_folder");
assert.equal(exampleCfg.entry.timer.task.from, "none");
assert.equal(exampleCfg.entry.automated.forge.github.enabled, false);
assert.equal("task" in exampleCfg.entry.automated, false);
assert.equal(exampleCfg.entry.automated.settings.on_start.task.from, "none");

assert.equal(
  floorToMinute("2026-08-15T21:07:32.500Z"),
  "2026-08-15T21:07:00.000Z",
);

assert.equal(
  intervalsOverlap(
    "2026-08-09T13:00:00.000Z",
    "2026-08-09T13:15:00.000Z",
    "2026-08-09T13:15:00.000Z",
    "2026-08-09T13:30:00.000Z",
  ),
  false,
);
assert.equal(
  intervalsOverlap(
    "2026-08-09T13:00:00.000Z",
    "2026-08-09T13:20:00.000Z",
    "2026-08-09T13:15:00.000Z",
    "2026-08-09T13:30:00.000Z",
  ),
  true,
);

const previous = [
  {
    id: "a",
    timeInterval: {
      start: "2026-08-09T13:00:00.000Z",
      end: "2026-08-09T13:15:00.000Z",
    },
  },
  {
    id: "b",
    timeInterval: {
      start: "2026-08-09T12:00:00.000Z",
      end: "2026-08-09T12:45:00.000Z",
    },
  },
];
assert.equal(latestCompletedEnd(previous), "2026-08-09T13:15:00.000Z");
assert.deepEqual(
  gapFitStart("2026-08-09T13:07:00.000Z", latestCompletedEnd(previous)),
  { start: "2026-08-09T13:15:00.000Z", fitted: true },
);
assert.equal(
  completedOverlaps(
    "2026-08-09T13:15:00.000Z",
    "2026-08-09T13:30:00.000Z",
    previous,
  ).length,
  0,
);
assert.equal(
  completedOverlaps(
    "2026-08-09T13:10:00.000Z",
    "2026-08-09T13:20:00.000Z",
    previous,
  ).length,
  1,
);
assert.equal(
  completedOverlaps(
    "2026-08-09T13:00:00.000Z",
    "2026-08-09T13:15:00.000Z",
    previous,
    "a",
  ).length,
  0,
);

assert.equal(overlapShouldProceed("prompt", 1, false), false);
assert.equal(overlapShouldProceed("prompt", 1, true), true);
assert.equal(overlapShouldProceed("override", 2, false), true);
assert.equal(overlapShouldProceed("prompt", 0, false), true);

const prepared = prepareStartInstant(
  "2026-08-09T13:07:32.000Z",
  false,
  cfg.entry.timer.rounding,
);
assert.equal(prepared.secondsFloored, true);
assert.equal(prepared.roundingApplied, true);
assert.equal(prepared.start, "2026-08-09T13:00:00.000Z");

const stopped = applyStopRounding(
  "2026-08-09T13:00:00.000Z",
  "2026-08-09T13:17:48.000Z",
  cfg.entry.timer.rounding,
);
assert.equal(stopped.applied, true);
assert.equal(stopped.end, "2026-08-09T13:15:00.000Z");

const customMinutes = parseClockifyConfig(
  parseYaml(`
plugin:
  version: 4
scope:
  workspace_id: ws_x
entry:
  timer:
    rounding:
      enabled: true
      increment_minutes: 15
      start_mode: down
      stop_mode: down
  automated:
    enabled: true
    forge:
      github:
        enabled: true
    settings:
      runaway:
        enabled: true
        stop_after_minutes: 15
    triggers:
      - event: pr_closed
        action: stop_timer
`),
);
assert.equal(customMinutes.entry.timer.rounding.start_mode, "down");
assert.equal(customMinutes.entry.timer.rounding.stop_mode, "down");
assert.equal(customMinutes.entry.automated.settings.runaway.stop_after_minutes, 15);
assert.equal(customMinutes.entry.automated.triggers[0]?.event, "pr_closed");

const quotedMinutes = parseClockifyConfig(
  parseYaml(`
plugin:
  version: 4
scope:
  workspace_id: ws_x
entry:
  timer:
    rounding:
      increment_minutes: "30"
      minimum_minutes: "20"
  automated:
    settings:
      runaway:
        stop_after_minutes: "15"
`),
);
assert.equal(quotedMinutes.entry.timer.rounding.increment_minutes, 30);
assert.equal(quotedMinutes.entry.timer.rounding.minimum_minutes, 20);
assert.equal(quotedMinutes.entry.automated.settings.runaway.stop_after_minutes, 15);

const shortRunaway = {
  enabled: true,
  stop_after_minutes: 15,
};
assert.equal(
  isTimerPastRunawayCeiling(
    new Date(Date.now() - 20 * 60 * 1000).toISOString(),
    shortRunaway,
  ),
  true,
);
assert.equal(
  isTimerPastRunawayCeiling(
    new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    shortRunaway,
  ),
  false,
);

const ceilingEnd = runawayCeilingEndIso("2026-09-06T12:00:00.000Z", 45);
assert.equal(ceilingEnd, "2026-09-06T12:45:00.000Z");

function assertInvalidConfig(raw: unknown, ...needles: string[]): void {
  try {
    parseClockifyConfig(raw);
    assert.fail("expected parseClockifyConfig to throw");
  } catch (error) {
    assert.ok(error instanceof Error);
    for (const needle of needles) {
      assert.ok(
        error.message.includes(needle),
        `expected ${JSON.stringify(error.message)} to include ${JSON.stringify(needle)}`,
      );
    }
  }
}

const allowedEvents =
  "issue_start | issue_finish | issue_switch | pr_ship | pr_closed";
const prMergedUnsupported =
  "pr_merged is not supported: GitHub merge is an unwatched action.";
assertInvalidConfig(
  {
    scope: { workspace_id: "ws_x" },
    entry: {
      automated: {
        enabled: true,
        forge: { github: { enabled: true } },
        triggers: [{ event: "pr_merged", action: "stop_timer" }],
      },
    },
  },
  "entry.automated.triggers.0.event",
  allowedEvents,
  prMergedUnsupported,
);
assertInvalidConfig(
  {
    scope: { workspace_id: "ws_x" },
    entry: {
      automated: {
        enabled: true,
        forge: { github: { enabled: true } },
        triggers: [{ event: "nope", action: "stop_timer" }],
      },
    },
  },
  "entry.automated.triggers.0.event",
  allowedEvents,
);
try {
  parseClockifyConfig({
    scope: { workspace_id: "ws_x" },
    entry: {
      automated: {
        enabled: true,
        forge: { github: { enabled: true } },
        triggers: [{ event: "nope", action: "stop_timer" }],
      },
    },
  });
  assert.fail("expected parseClockifyConfig to throw");
} catch (error) {
  assert.ok(error instanceof Error);
  assert.equal(error.message.includes(prMergedUnsupported), false);
}

withFixture((dir) => {
  mkdirSync(join(dir, ".clockify"), { recursive: true });
  writeFileSync(
    join(dir, ".clockify", "config.yml"),
    `plugin:\n  version: 4\nscope:\n  workspace_id: ws_x\nentry:\n  automated:\n    enabled: true\n    forge:\n      github:\n        enabled: true\n    triggers:\n      - event: pr_merged\n        action: stop_timer\n`,
  );
  try {
    loadClockifyConfig(dir);
    assert.fail("expected loadClockifyConfig to throw");
  } catch (error) {
    assert.ok(error instanceof Error);
    assert.ok(error.message.includes("entry.automated.triggers.0.event"));
    assert.ok(error.message.includes(allowedEvents));
    assert.ok(error.message.includes(prMergedUnsupported));
    assert.ok(error.message.includes(join(dir, ".clockify", "config.yml")));
  }
});


assert.throws(
  () =>
    parseClockifyConfig({
      plugin: { version: 3 },
      scope: { workspace_id: "ws_x" },
    }),
  /plugin\.version 3/,
);

assert.throws(
  () =>
    parseClockifyConfig({
      scope: { workspace_id: "ws_x" },
      entry: {
        automated: {
          forge: {
            github: { enabled: true },
            gitlab: { enabled: true },
          },
        },
      },
    }),
  /at most one forge may be enabled/,
);

assert.throws(
  () =>
    parseClockifyConfig({
      scope: { workspace_id: "ws_x" },
      entry: {
        automated: {
          enabled: true,
          forge: { gitlab: { enabled: true } },
          triggers: [{ event: "issue_start", action: "start_timer" }],
        },
      },
    }),
  /forge gitlab triggers are not implemented/,
);

console.log("OK: config unit checks");
