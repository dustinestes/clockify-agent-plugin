import { existsSync, readFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { parse as parseYaml } from "yaml";
import { z } from "zod";

const automationEventSchema = z.enum([
  "issue_start",
  "issue_finish",
  "issue_switch",
  "pr_ship",
  "pr_closed",
]);

const automationActionSchema = z.enum([
  "start_timer",
  "stop_timer",
  "stop_then_start",
]);

const modeTriggerEventSchema = z.enum(["start", "stop"]);

const positiveInt = z.coerce.number().int().positive();

export const roundingModeSchema = z.enum(["nearest", "up", "down"]);
export type RoundingMode = z.infer<typeof roundingModeSchema>;

const roundingSchema = z
  .object({
    enabled: z.boolean().default(false),
    increment_minutes: positiveInt.default(15),
    mode: roundingModeSchema.default("nearest"),
    start_mode: roundingModeSchema.optional(),
    stop_mode: roundingModeSchema.optional(),
    minimum_minutes: positiveInt.optional(),
  })
  .default({});

const descriptionStrategySchema = (fromDefault: "prompt" | "template") =>
  z
    .object({
      from: z.enum(["prompt", "template"]).default(fromDefault),
      template: z.string().default("{issue_number} - {issue_title}"),
    })
    .default({});

/** Manual enter-time: caller supplies text. No issue templates (see #74). */
const manualDescriptionSchema = z
  .object({
    from: z.literal("prompt").default("prompt"),
  })
  .default({});

const interactiveTaskSchema = z
  .object({
    from: z
      .enum(["prompt", "template", "fixed", "local_folder", "none"])
      .default("prompt"),
    template: z.string().optional(),
    name: z.string().optional(),
    if_missing: z.enum(["prompt", "create", "none"]).default("prompt"),
  })
  .default({});

/** Timer defaults to no task so starts are not blocked waiting on a name. */
const timerTaskSchema = z
  .object({
    from: z
      .enum(["prompt", "template", "fixed", "local_folder", "none"])
      .default("none"),
    template: z.string().optional(),
    name: z.string().optional(),
    if_missing: z.enum(["prompt", "create", "none"]).default("none"),
  })
  .default({});

const onStartTaskSchema = z
  .object({
    from: z
      .enum(["prompt", "template", "fixed", "local_folder", "none"])
      .default("none"),
    template: z.string().optional(),
    name: z.string().optional(),
    if_missing: z.enum(["create", "none", "prompt"]).default("none"),
  })
  .default({});

const overlapSchema = z
  .object({
    on_conflict: z.enum(["prompt", "override"]).default("prompt"),
  })
  .default({});

const runawaySchema = z
  .object({
    enabled: z.boolean().default(false),
    stop_after_minutes: positiveInt.default(45),
  })
  .default({});

const projectSchema = z
  .object({
    from: z.enum(["local_folder", "fixed", "prompt"]).default("local_folder"),
    name: z.string().optional(),
  })
  .default({});

const timerMethodSchema = z
  .object({
    include_seconds: z.boolean().default(false),
    description: descriptionStrategySchema("prompt"),
    task: timerTaskSchema,
    rounding: roundingSchema,
    overlap: overlapSchema,
  })
  .default({});

const manualMethodSchema = z
  .object({
    description: manualDescriptionSchema,
    task: interactiveTaskSchema,
    overlap: overlapSchema,
  })
  .default({});

const onStartSchema = z
  .object({
    when_multiple_labels: z.enum(["first", "prompt"]).default("first"),
    description: descriptionStrategySchema("prompt"),
    task: onStartTaskSchema,
  })
  .default({});

const cursorModeTaskSchema = z
  .object({
    from: z.enum(["fixed", "none"]).default("fixed"),
    name: z.string().optional(),
    if_missing: z.enum(["create", "none"]).default("create"),
  })
  .default({});

const cursorModeSchema = z.object({
  enabled: z.boolean().default(true),
  triggers: z
    .array(
      z.object({
        event: modeTriggerEventSchema,
        action: automationActionSchema,
      }),
    )
    .default([
      { event: "start", action: "start_timer" },
      { event: "stop", action: "stop_timer" },
    ]),
  description: descriptionStrategySchema("prompt"),
  task: cursorModeTaskSchema,
});

const cursorPlatformsSchema = z
  .object({
    enabled: z.boolean().default(false),
    modes: z.record(cursorModeSchema).default({}),
  })
  .default({});

const platformsSchema = z
  .object({
    cursor: cursorPlatformsSchema,
  })
  .default({});

const forgeSchema = z.enum(["none", "github", "gitlab", "bitbucket"]);

const automatedMethodSchema = z
  .object({
    enabled: z.boolean().default(false),
    forge: forgeSchema.default("none"),
    include_seconds: z.boolean().default(false),
    on_start: onStartSchema,
    rounding: roundingSchema,
    overlap: overlapSchema,
    triggers: z
      .array(
        z.object({
          event: automationEventSchema,
          action: automationActionSchema,
        }),
      )
      .default([]),
    runaway: runawaySchema,
    platforms: platformsSchema,
  })
  .default({});

export const clockifyConfigSchema = z
  .object({
    plugin: z
      .object({
        version: z.literal(3).default(3),
      })
      .default({}),
    scope: z
      .object({
        workspace_id: z
          .string()
          .trim()
          .min(1, "scope.workspace_id is required. Re-run /clockify-init."),
        project: projectSchema,
      })
      .default({ workspace_id: "unconfigured" }),
    entry: z
      .object({
        timer: timerMethodSchema,
        manual: manualMethodSchema,
        automated: automatedMethodSchema,
      })
      .default({}),
  })
  .superRefine((cfg, ctx) => {
    const automated = cfg.entry.automated;
    rejectLegacyTaskFrom(cfg.entry.timer.task, ["entry", "timer", "task"], ctx);
    rejectLegacyTaskFrom(cfg.entry.manual.task, ["entry", "manual", "task"], ctx);
    rejectLegacyTaskFrom(
      automated.on_start.task,
      ["entry", "automated", "on_start", "task"],
      ctx,
    );

    if (!automated.enabled) {
      if (automated.triggers.length > 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["entry", "automated", "triggers"],
          message:
            "triggers must be empty when entry.automated.enabled is false",
        });
      }
      return;
    }

    if (automated.forge === "none" && automated.triggers.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["entry", "automated", "triggers"],
        message:
          "forge triggers require entry.automated.forge to be github (or another forge), not none",
      });
    }

    if (
      automated.forge !== "github" &&
      automated.forge !== "none" &&
      automated.triggers.length > 0
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["entry", "automated", "forge"],
        message: `forge ${automated.forge} triggers are not implemented yet; use github or clear triggers`,
      });
    }
  });

function rejectLegacyTaskFrom(
  task: { from?: string },
  path: (string | number)[],
  ctx: z.RefinementCtx,
): void {
  if (task.from === "github_label") {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: [...path, "from"],
      message:
        'github_label is removed. Use from: template with template: "{label}"',
    });
  }
  if (task.from === "repo") {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: [...path, "from"],
      message: "repo is renamed to local_folder",
    });
  }
}

export type ClockifyConfig = z.infer<typeof clockifyConfigSchema>;
export type RoundingConfig = ClockifyConfig["entry"]["timer"]["rounding"];
export type RunawayConfig = ClockifyConfig["entry"]["automated"]["runaway"];
export type DescriptionConfig =
  | ClockifyConfig["entry"]["timer"]["description"]
  | ClockifyConfig["entry"]["manual"]["description"]
  | ClockifyConfig["entry"]["automated"]["on_start"]["description"];
export type OnStartConfig = ClockifyConfig["entry"]["automated"]["on_start"];
export type CursorModeConfig = z.infer<typeof cursorModeSchema>;
export type Forge = z.infer<typeof forgeSchema>;

export type LoadedConfig = {
  found: boolean;
  path: string | null;
  root: string | null;
  config: ClockifyConfig;
};

/** Canonical consumer config path under the project root. */
export const CANONICAL_CONFIG_REL = join(".clockify", "config.yml");

export function defaultConfig(): ClockifyConfig {
  return clockifyConfigSchema.parse({});
}

/** Project root for a config file path (parent of `.clockify/` when nested). */
export function projectRootFromConfigPath(configPath: string): string {
  const resolved = resolve(configPath);
  const parent = dirname(resolved);
  if (basename(parent) === ".clockify") {
    return dirname(parent);
  }
  return parent;
}

function isProjectRootMarker(dir: string): boolean {
  return (
    existsSync(join(dir, CANONICAL_CONFIG_REL)) ||
    existsSync(join(dir, ".clockify")) ||
    existsSync(join(dir, ".git"))
  );
}

/** Resolve config file under a known project root. */
export function resolveConfigPathInRoot(root: string): string | null {
  const canonical = join(root, CANONICAL_CONFIG_REL);
  return existsSync(canonical) ? canonical : null;
}

/** Walk upward from startDir looking for .git or `.clockify/`. Does not read env. */
export function findProjectRoot(startDir = process.cwd()): string | null {
  let dir = resolve(startDir);
  for (;;) {
    if (isProjectRootMarker(dir)) {
      return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

export type LoadClockifyConfigOptions = {
  /** Project root that contains `.clockify/config.yml`. Wins over cwd and CLOCKIFY_CONFIG_ROOT. */
  configRoot?: string;
};

function loadFromKnownRoot(root: string): LoadedConfig {
  const resolved = resolve(root);
  const path = resolveConfigPathInRoot(resolved);
  if (!path) {
    return {
      found: false,
      path: join(resolved, CANONICAL_CONFIG_REL),
      root: resolved,
      config: defaultConfig(),
    };
  }
  return {
    found: true,
    path,
    root: resolved,
    config: parseConfigFile(path),
  };
}

/** Paths and env the loader considered. For get_config miss payloads. */
export function describeConfigDiscovery(configRoot?: string): {
  config_root: string | null;
  CLOCKIFY_CONFIG_PATH: string | null;
  CLOCKIFY_CONFIG_ROOT: string | null;
  cwd: string;
} {
  return {
    config_root: configRoot?.trim() || null,
    CLOCKIFY_CONFIG_PATH: process.env.CLOCKIFY_CONFIG_PATH?.trim() || null,
    CLOCKIFY_CONFIG_ROOT: process.env.CLOCKIFY_CONFIG_ROOT?.trim() || null,
    cwd: process.cwd(),
  };
}

/**
 * Discovery order: CLOCKIFY_CONFIG_PATH, options.configRoot, CLOCKIFY_CONFIG_ROOT, walk from startDir.
 */
export function loadClockifyConfig(
  startDir = process.cwd(),
  options?: LoadClockifyConfigOptions,
): LoadedConfig {
  const explicit = process.env.CLOCKIFY_CONFIG_PATH?.trim();
  if (explicit) {
    const path = resolve(explicit);
    const root = projectRootFromConfigPath(path);
    if (!existsSync(path)) {
      return {
        found: false,
        path,
        root,
        config: defaultConfig(),
      };
    }
    return {
      found: true,
      path,
      root,
      config: parseConfigFile(path),
    };
  }

  const argRoot = options?.configRoot?.trim();
  if (argRoot) {
    return loadFromKnownRoot(argRoot);
  }

  const envRoot = process.env.CLOCKIFY_CONFIG_ROOT?.trim();
  if (envRoot && existsSync(envRoot)) {
    return loadFromKnownRoot(envRoot);
  }

  const root = findProjectRoot(startDir);
  if (!root) {
    return { found: false, path: null, root: null, config: defaultConfig() };
  }
  const path = resolveConfigPathInRoot(root);
  if (!path) {
    return { found: false, path: null, root, config: defaultConfig() };
  }
  return {
    found: true,
    path,
    root,
    config: parseConfigFile(path),
  };
}

export function formatClockifyConfigError(error: z.ZodError): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join(".") : "(root)";
      if (issue.code === z.ZodIssueCode.invalid_enum_value) {
        const expected = `Invalid enum value. Expected ${issue.options.join(" | ")}`;
        if (issue.received === "pr_merged") {
          return `${path}: ${expected}. pr_merged is not supported: GitHub merge is an unwatched action.`;
        }
        if (issue.received === "github_label") {
          return `${path}: ${expected}. github_label is removed; use from: template with template: "{label}"`;
        }
        if (issue.received === "repo") {
          return `${path}: ${expected}. repo is renamed to local_folder`;
        }
        return `${path}: ${expected}`;
      }
      return `${path}: ${issue.message}`;
    })
    .join("\n");
}

const V3_REINIT =
  "Re-run /clockify-init (then /clockify-automate if you need forge or Cursor automation), or replace .clockify/config.yml from the plugin example.";

export function parseClockifyConfig(
  raw: unknown,
  source = "config",
): ClockifyConfig {
  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    if ("version" in obj && !("plugin" in obj) && !("plugin_internal" in obj)) {
      throw new Error(
        `Invalid Clockify config (${source}): old root shape (version at file root). ${V3_REINIT}`,
      );
    }
    if ("plugin_internal" in obj || "entry_methods" in obj) {
      throw new Error(
        `Invalid Clockify config (${source}): v2 keys (plugin_internal / entry_methods). v3 uses plugin / entry. ${V3_REINIT}`,
      );
    }
    if (
      obj.plugin &&
      typeof obj.plugin === "object" &&
      (obj.plugin as { version?: unknown }).version === 2
    ) {
      throw new Error(
        `Invalid Clockify config (${source}): plugin.version 2 is not supported. ${V3_REINIT}`,
      );
    }
  }
  const result = clockifyConfigSchema.safeParse(raw ?? {});
  if (!result.success) {
    throw new Error(
      `Invalid Clockify config (${source}):\n${formatClockifyConfigError(result.error)}`,
    );
  }
  return result.data;
}

function parseConfigFile(path: string): ClockifyConfig {
  const raw = parseYaml(readFileSync(path, "utf8"));
  return parseClockifyConfig(raw, path);
}

const UNCONFIGURED_WORKSPACE = "unconfigured";

/** Pinned `scope.workspace_id` when config was found; never Clockify “active”. */
export function resolveConfiguredWorkspaceId(
  config: ClockifyConfig,
  found = true,
): string | undefined {
  if (!found) return undefined;
  const id = config.scope.workspace_id.trim();
  if (!id || id === UNCONFIGURED_WORKSPACE) return undefined;
  return id;
}

export function resolveProjectName(
  config: ClockifyConfig,
  root: string | null,
): string | null {
  if (config.scope.project.from === "prompt") {
    return null;
  }
  if (config.scope.project.from === "fixed") {
    return config.scope.project.name?.trim() || null;
  }
  if (config.scope.project.name?.trim()) {
    return config.scope.project.name.trim();
  }
  if (!root) return null;
  return basename(root);
}

/** Git toplevel folder name (always); ignores `project.from`. */
export function resolveRepoName(root: string | null): string | null {
  if (!root) return null;
  return basename(root);
}

export type TemplateFields = {
  issue_number?: string | number;
  issue_title?: string;
  label?: string;
  /** @deprecated use label */
  github_label?: string;
  local_folder?: string;
  /** @deprecated use local_folder */
  repo?: string;
  planTitle?: string;
  debugTitle?: string;
};

export function applyDescriptionTemplate(
  template: string,
  fields: TemplateFields,
): string {
  const issueNumber =
    fields.issue_number === undefined || fields.issue_number === ""
      ? ""
      : String(fields.issue_number).replace(/^#/, "");
  const issueTitle = fields.issue_title?.trim() ?? "";
  const label =
    fields.label?.trim() || fields.github_label?.trim() || "";
  const localFolder =
    fields.local_folder?.trim() || fields.repo?.trim() || "";
  const planTitle = fields.planTitle?.trim() ?? "";
  const debugTitle = fields.debugTitle?.trim() ?? "";

  return template
    .replaceAll("{issue_number}", issueNumber ? `#${issueNumber}` : "")
    .replaceAll("{issue_title}", issueTitle)
    .replaceAll("{label}", label)
    .replaceAll("{github_label}", label)
    .replaceAll("{local_folder}", localFolder)
    .replaceAll("{repo}", localFolder)
    .replaceAll("{planTitle}", planTitle)
    .replaceAll("{debugTitle}", debugTitle)
    .replace(/\s+/g, " ")
    .trim();
}

export function resolveEntryDescription(
  description: DescriptionConfig,
  input: {
    description?: string;
    issue_number?: string | number;
    issue_title?: string;
    label?: string;
    github_label?: string;
    local_folder?: string;
    repo?: string;
    planTitle?: string;
    debugTitle?: string;
  },
): string | undefined {
  if (input.description?.trim()) return input.description.trim();
  if (description.from === "prompt") return undefined;
  const label = input.label?.trim() || input.github_label?.trim();
  const hasFields =
    input.issue_number !== undefined ||
    Boolean(input.issue_title?.trim()) ||
    Boolean(label) ||
    Boolean(input.planTitle?.trim()) ||
    Boolean(input.debugTitle?.trim());
  if (!hasFields) return undefined;
  return applyDescriptionTemplate(description.template, input);
}

export function templateUsesLabel(template: string | undefined): boolean {
  if (!template) return false;
  return template.includes("{label}") || template.includes("{github_label}");
}

export function onStartUsesLabel(onStart: OnStartConfig): boolean {
  return (
    (onStart.description.from === "template" &&
      templateUsesLabel(onStart.description.template)) ||
    (onStart.task.from === "template" &&
      templateUsesLabel(onStart.task.template))
  );
}

export function isAutomationConfigured(config: ClockifyConfig): boolean {
  return config.entry.automated.enabled && config.entry.automated.forge !== "none";
}

export function resolveCursorModeBlock(
  config: ClockifyConfig,
  mode: string,
): CursorModeConfig | null {
  const cursor = config.entry.automated.platforms.cursor;
  if (!cursor.enabled) return null;
  const block = cursor.modes[mode];
  if (!block || !block.enabled) return null;
  return block;
}

export function resolveCursorModeTaskName(
  config: ClockifyConfig,
  mode: string,
): string | null {
  const block = resolveCursorModeBlock(config, mode);
  if (!block || block.task.from !== "fixed") return null;
  return block.task.name?.trim() || null;
}

/** Fixed Cursor mode task names to ensure when platforms.cursor is enabled. */
export function listCursorModeTasksToEnsure(config: ClockifyConfig): string[] {
  const cursor = config.entry.automated.platforms.cursor;
  if (!cursor.enabled) return [];
  const names: string[] = [];
  for (const block of Object.values(cursor.modes)) {
    if (!block.enabled) continue;
    if (block.task.from !== "fixed") continue;
    if (block.task.if_missing !== "create") continue;
    const name = block.task.name?.trim();
    if (name) names.push(name);
  }
  return names;
}

export function roundDate(
  date: Date,
  incrementMinutes: number,
  mode: RoundingMode,
): Date {
  const ms = incrementMinutes * 60 * 1000;
  const t = date.getTime();
  let rounded: number;
  if (mode === "up") {
    rounded = Math.ceil(t / ms) * ms;
  } else if (mode === "down") {
    rounded = Math.floor(t / ms) * ms;
  } else {
    rounded = Math.round(t / ms) * ms;
  }
  return new Date(rounded);
}

export function applyRoundingToInterval(
  startIso: string,
  endIso: string,
  rounding: RoundingConfig,
): {
  start: string;
  end: string;
  raw: { start: string; end: string };
  applied: boolean;
} {
  const raw = { start: startIso, end: endIso };
  if (!rounding.enabled) {
    return { start: startIso, end: endIso, raw, applied: false };
  }

  const startMode = rounding.start_mode ?? rounding.mode;
  const stopMode = rounding.stop_mode ?? rounding.mode;

  let start = roundDate(
    new Date(startIso),
    rounding.increment_minutes,
    startMode,
  );
  let end = roundDate(new Date(endIso), rounding.increment_minutes, stopMode);

  const durationMs = end.getTime() - start.getTime();
  const floorMinutes =
    rounding.minimum_minutes ??
    (durationMs <= 0 ? rounding.increment_minutes : undefined);
  if (
    floorMinutes !== undefined &&
    durationMs < floorMinutes * 60 * 1000
  ) {
    end = new Date(start.getTime() + floorMinutes * 60 * 1000);
  }

  return {
    start: start.toISOString(),
    end: end.toISOString(),
    raw,
    applied: true,
  };
}

export function isTimerPastRunawayCeiling(
  startedAtIso: string,
  runaway: RunawayConfig,
  now = new Date(),
): boolean {
  if (!runaway.enabled) return false;
  const started = new Date(startedAtIso).getTime();
  const limitMs = runaway.stop_after_minutes * 60 * 1000;
  return now.getTime() - started >= limitMs;
}

/** Hard ceiling end for runaway-path stop: start + stop_after_minutes (no rounding). */
export function runawayCeilingEndIso(
  startedAtIso: string,
  stopAfterMinutes: number,
): string {
  const startMs = new Date(startedAtIso).getTime();
  return new Date(startMs + stopAfterMinutes * 60 * 1000).toISOString();
}

export type EntryMethod = "timer" | "manual" | "automated";
export type TimerEntryMethod = "timer" | "automated";

export function floorToMinute(iso: string): string {
  const d = new Date(iso);
  d.setUTCSeconds(0, 0);
  d.setUTCMilliseconds(0);
  return d.toISOString();
}

/** Half-open [start, end). Abutting ends/starts do not overlap. */
export function intervalsOverlap(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): boolean {
  return (
    new Date(aStart).getTime() < new Date(bEnd).getTime() &&
    new Date(bStart).getTime() < new Date(aEnd).getTime()
  );
}

export type IntervalEntry = {
  id?: string;
  description?: string;
  timeInterval: { start: string; end: string | null };
};

export function completedOverlaps(
  start: string,
  end: string,
  entries: IntervalEntry[],
  excludeId?: string,
): IntervalEntry[] {
  return entries.filter((entry) => {
    if (excludeId && entry.id === excludeId) return false;
    const otherEnd = entry.timeInterval.end;
    if (!otherEnd) return false;
    return intervalsOverlap(start, end, entry.timeInterval.start, otherEnd);
  });
}

export function latestCompletedEnd(entries: IntervalEntry[]): string | null {
  let latest: string | null = null;
  let latestMs = Number.NEGATIVE_INFINITY;
  for (const entry of entries) {
    const end = entry.timeInterval.end;
    if (!end) continue;
    const ms = new Date(end).getTime();
    if (ms > latestMs) {
      latestMs = ms;
      latest = end;
    }
  }
  return latest;
}

export function gapFitStart(
  proposedStart: string,
  previousEnd: string | null,
): { start: string; fitted: boolean } {
  if (!previousEnd) return { start: proposedStart, fitted: false };
  if (new Date(proposedStart).getTime() < new Date(previousEnd).getTime()) {
    return { start: previousEnd, fitted: true };
  }
  return { start: proposedStart, fitted: false };
}

export function prepareStartInstant(
  rawStart: string,
  includeSeconds: boolean,
  rounding: RoundingConfig,
): {
  start: string;
  raw: string;
  secondsFloored: boolean;
  roundingApplied: boolean;
} {
  let start = rawStart;
  const secondsFloored = !includeSeconds;
  if (secondsFloored) {
    start = floorToMinute(start);
  }
  let roundingApplied = false;
  if (rounding.enabled) {
    const startMode = rounding.start_mode ?? rounding.mode;
    start = roundDate(
      new Date(start),
      rounding.increment_minutes,
      startMode,
    ).toISOString();
    roundingApplied = true;
  }
  return { start, raw: rawStart, secondsFloored, roundingApplied };
}

/** Round stop end only; keep the stored start. */
export function applyStopRounding(
  storedStartIso: string,
  rawEndIso: string,
  rounding: RoundingConfig,
): { end: string; rawEnd: string; applied: boolean } {
  if (!rounding.enabled) {
    return { end: rawEndIso, rawEnd: rawEndIso, applied: false };
  }
  const stopMode = rounding.stop_mode ?? rounding.mode;
  let end = roundDate(
    new Date(rawEndIso),
    rounding.increment_minutes,
    stopMode,
  );
  const startMs = new Date(storedStartIso).getTime();
  const durationMs = end.getTime() - startMs;
  const floorMinutes =
    rounding.minimum_minutes ??
    (durationMs <= 0 ? rounding.increment_minutes : undefined);
  if (
    floorMinutes !== undefined &&
    durationMs < floorMinutes * 60 * 1000
  ) {
    end = new Date(startMs + floorMinutes * 60 * 1000);
  }
  return { end: end.toISOString(), rawEnd: rawEndIso, applied: true };
}

export function overlapShouldProceed(
  onConflict: "prompt" | "override",
  overlapCount: number,
  confirmOverlap?: boolean,
): boolean {
  if (overlapCount === 0) return true;
  if (onConflict === "override") return true;
  return Boolean(confirmOverlap);
}
