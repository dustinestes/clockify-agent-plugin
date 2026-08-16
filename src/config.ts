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

const descriptionSchema = (fromDefault: "prompt" | "template") =>
  z
    .object({
      from: z.enum(["prompt", "template"]).default(fromDefault),
      template: z.string().default("{issue_number} - {issue_title}"),
    })
    .default({});

const interactiveTaskSchema = z
  .object({
    from: z.enum(["prompt", "github_label", "none"]).default("prompt"),
    if_missing: z.enum(["prompt", "create", "none"]).default("prompt"),
  })
  .default({});

const automatedTaskSchema = z
  .object({
    from: z.enum(["github_label", "none"]).default("github_label"),
    if_missing: z.enum(["create", "none"]).default("create"),
  })
  .default({});

const overlapSchema = z
  .object({
    on_conflict: z.enum(["prompt", "override"]).default("prompt"),
  })
  .default({});

const inactivitySchema = z
  .object({
    enabled: z.boolean().default(false),
    stop_after_minutes: positiveInt.default(45),
  })
  .default({});

export const clockifyConfigSchema = z.object({
  version: z.literal(1).default(1),
  project: z
    .object({
      name_from: z.enum(["repo", "fixed"]).default("repo"),
      name: z.string().optional(),
    })
    .default({}),
  timer: z
    .object({
      include_seconds: z.boolean().default(false),
      description: descriptionSchema("prompt"),
      task: interactiveTaskSchema,
      rounding: roundingSchema,
      overlap: overlapSchema,
    })
    .default({}),
  manual: z
    .object({
      description: descriptionSchema("prompt"),
      task: interactiveTaskSchema,
      overlap: overlapSchema,
    })
    .default({}),
  automated: z
    .object({
      include_seconds: z.boolean().default(false),
      description: descriptionSchema("template"),
      task: automatedTaskSchema,
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
      inactivity: inactivitySchema,
    })
    .default({}),
});

export type ClockifyConfig = z.infer<typeof clockifyConfigSchema>;
export type RoundingConfig = ClockifyConfig["timer"]["rounding"];
export type InactivityConfig = ClockifyConfig["automated"]["inactivity"];
export type DescriptionConfig = ClockifyConfig["timer"]["description"];

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

/** Walk upward from startDir looking for .git or `.clockify/`. */
export function findProjectRoot(startDir = process.cwd()): string | null {
  const envRoot = process.env.CLOCKIFY_CONFIG_ROOT?.trim();
  if (envRoot && existsSync(envRoot)) {
    return resolve(envRoot);
  }

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

export function loadClockifyConfig(
  startDir = process.cwd(),
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
        return `${path}: ${expected}`;
      }
      return `${path}: ${issue.message}`;
    })
    .join("\n");
}

export function parseClockifyConfig(
  raw: unknown,
  source = "config",
): ClockifyConfig {
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

export function resolveProjectName(
  config: ClockifyConfig,
  root: string | null,
): string | null {
  if (config.project.name_from === "fixed") {
    return config.project.name?.trim() || null;
  }
  if (config.project.name?.trim()) {
    return config.project.name.trim();
  }
  if (!root) return null;
  return basename(root);
}

export function applyDescriptionTemplate(
  template: string,
  fields: {
    issue_number?: string | number;
    issue_title?: string;
    github_label?: string;
    repo?: string;
  },
): string {
  const issueNumber =
    fields.issue_number === undefined || fields.issue_number === ""
      ? ""
      : String(fields.issue_number).replace(/^#/, "");
  const issueTitle = fields.issue_title?.trim() ?? "";
  const label = fields.github_label?.trim() ?? "";
  const repo = fields.repo?.trim() ?? "";

  return template
    .replaceAll("{issue_number}", issueNumber ? `#${issueNumber}` : "")
    .replaceAll("{issue_title}", issueTitle)
    .replaceAll("{github_label}", label)
    .replaceAll("{repo}", repo)
    .replace(/\s+/g, " ")
    .trim();
}

export function resolveEntryDescription(
  description: DescriptionConfig,
  input: {
    description?: string;
    issue_number?: string | number;
    issue_title?: string;
    github_label?: string;
    repo?: string;
  },
): string | undefined {
  if (input.description?.trim()) return input.description.trim();
  if (description.from === "prompt") return undefined;
  const hasFields =
    input.issue_number !== undefined ||
    Boolean(input.issue_title?.trim()) ||
    Boolean(input.github_label?.trim());
  if (!hasFields) return undefined;
  return applyDescriptionTemplate(description.template, input);
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

export function isTimerPastInactivity(
  startedAtIso: string,
  inactivity: InactivityConfig,
  now = new Date(),
): boolean {
  if (!inactivity.enabled) return false;
  const started = new Date(startedAtIso).getTime();
  const limitMs = inactivity.stop_after_minutes * 60 * 1000;
  return now.getTime() - started >= limitMs;
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
