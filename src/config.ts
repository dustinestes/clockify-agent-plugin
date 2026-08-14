import { existsSync, readFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { parse as parseYaml } from "yaml";
import { z } from "zod";

const automationEventSchema = z.enum([
  "issue_start",
  "issue_finish",
  "issue_switch",
  "pr_ship",
  "pr_merged",
]);

const automationActionSchema = z.enum([
  "start_timer",
  "stop_timer",
  "stop_then_start",
]);

export const clockifyConfigSchema = z.object({
  version: z.literal(1).default(1),
  project: z
    .object({
      name_from: z.enum(["repo", "fixed"]).default("repo"),
      name: z.string().optional(),
    })
    .default({}),
  rounding: z
    .object({
      enabled: z.boolean().default(false),
      increment_minutes: z.number().int().positive().default(15),
      mode: z.enum(["nearest", "up", "down"]).default("nearest"),
    })
    .default({}),
  description: z
    .object({
      template: z.string().default("{issue_number} {issue_title}"),
    })
    .default({}),
  mapping: z
    .object({
      project: z.enum(["repo_name", "fixed"]).default("repo_name"),
      task_from: z
        .enum(["github_label", "github_issue", "none"])
        .default("github_label"),
    })
    .default({}),
  automation: z
    .object({
      triggers: z
        .array(
          z.object({
            event: automationEventSchema,
            action: automationActionSchema,
          }),
        )
        .default([]),
      inactivity: z
        .object({
          enabled: z.boolean().default(false),
          stop_after_minutes: z.number().int().positive().default(45),
        })
        .default({}),
    })
    .default({}),
});

export type ClockifyConfig = z.infer<typeof clockifyConfigSchema>;

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

function parseConfigFile(path: string): ClockifyConfig {
  const raw = parseYaml(readFileSync(path, "utf8"));
  return clockifyConfigSchema.parse(raw ?? {});
}

export function resolveProjectName(
  config: ClockifyConfig,
  root: string | null,
): string | null {
  if (config.project.name_from === "fixed" || config.mapping.project === "fixed") {
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

export type RoundingMode = "nearest" | "up" | "down";

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
  rounding: ClockifyConfig["rounding"],
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

  let start = roundDate(
    new Date(startIso),
    rounding.increment_minutes,
    rounding.mode,
  );
  let end = roundDate(
    new Date(endIso),
    rounding.increment_minutes,
    rounding.mode,
  );

  const minMs = rounding.increment_minutes * 60 * 1000;
  if (end.getTime() <= start.getTime()) {
    end = new Date(start.getTime() + minMs);
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
  inactivity: ClockifyConfig["automation"]["inactivity"],
  now = new Date(),
): boolean {
  if (!inactivity.enabled) return false;
  const started = new Date(startedAtIso).getTime();
  const limitMs = inactivity.stop_after_minutes * 60 * 1000;
  return now.getTime() - started >= limitMs;
}
