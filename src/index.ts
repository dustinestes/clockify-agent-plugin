#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  ClockifyClient,
  ClockifyError,
  type ClockifyTimeEntry,
  endOfLocalDayIso,
  formatDuration,
  parseDurationSeconds,
  startOfLocalDayIso,
} from "./clockify-client.js";
import {
  applyStopRounding,
  completedOverlaps,
  floorToMinute,
  gapFitStart,
  isTimerPastInactivity,
  latestCompletedEnd,
  describeConfigDiscovery,
  loadClockifyConfig,
  overlapShouldProceed,
  prepareStartInstant,
  resolveConfiguredWorkspaceId,
  resolveEntryDescription,
  resolveProjectName,
  resolveRepoName,
  type LoadedConfig,
  type EntryMethod,
  type TimerEntryMethod,
} from "./config.js";
import { formatLogError, installProcessLogHandlers, log } from "./log.js";

function requireApiKey(): string {
  const key = process.env.CLOCKIFY_API_KEY?.trim();
  if (!key) {
    throw new Error(
      "CLOCKIFY_API_KEY is required. See docs/use.md → Credentials, then set it in your MCP / plugin env.",
    );
  }
  return key;
}

const configRootField = z
  .string()
  .optional()
  .describe(
    "Absolute git toplevel of the repo that contains .clockify/config.yml. Resolve once per session with `git rev-parse --show-toplevel` from the working directory (open tabs are not required); reuse that string on later calls unless the repo or focused root changed. Do not pass a multi-root .code-workspace folder.",
  );

const CONFIG_ROOT_TOOL_HINT =
  " Pass config_root as that repo's git toplevel when this MCP is user-scoped.";

function loadConfig(configRoot?: string): LoadedConfig {
  return loadClockifyConfig(process.cwd(), { configRoot });
}

function client(configRoot?: string): ClockifyClient {
  const loaded = loadConfig(configRoot);
  return new ClockifyClient(
    requireApiKey(),
    resolveConfiguredWorkspaceId(loaded.config, loaded.found),
  );
}

const workspaceIdField = z
  .string()
  .optional()
  .describe(
    "Workspace ID. Defaults to scope.workspace_id from config.yml (required pin). Never the Clockify UI active workspace.",
  );

function configMissPayload(loaded: LoadedConfig, configRoot?: string) {
  return {
    found: false as const,
    path: loaded.path,
    root: loaded.root,
    tried: describeConfigDiscovery(configRoot),
    hint: "No .clockify/config.yml found. Pass config_root as the git toplevel (git rev-parse --show-toplevel) of the repo that contains the file, or run /clockify-init.",
  };
}

function configMissResult(loaded: LoadedConfig, configRoot?: string) {
  return {
    isError: true,
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(configMissPayload(loaded, configRoot), null, 2),
      },
    ],
  };
}

function textResult(data: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: typeof data === "string" ? data : JSON.stringify(data, null, 2),
      },
    ],
  };
}

function errorResult(error: unknown) {
  const message =
    error instanceof ClockifyError
      ? error.message
      : error instanceof Error
        ? error.message
        : String(error);
  if (error instanceof ClockifyError) {
    log.error("clockify_http_error", formatLogError(error));
  }
  return {
    isError: true,
    content: [{ type: "text" as const, text: message }],
  };
}

function toolEndFields(result: {
  isError?: boolean;
  content?: Array<{ type: string; text?: string }>;
}): Record<string, unknown> {
  if (!result.isError) return { status: "success" };
  const text = result.content?.find((part) => part.type === "text")?.text;
  if (!text) return { status: "fail", expected: false, reason: "empty" };
  try {
    const parsed = JSON.parse(text) as {
      found?: boolean;
      overlap?: boolean;
      hint?: string;
      path?: string;
      root?: string;
      tried?: unknown;
      on_conflict?: string;
      entries?: unknown[];
    };
    if (parsed.found === false) {
      return {
        status: "warning",
        expected: true,
        reason: "config_miss",
        path: parsed.path,
        root: parsed.root,
        tried: parsed.tried,
      };
    }
    if (parsed.overlap) {
      return {
        status: "warning",
        expected: true,
        reason: "overlap",
        on_conflict: parsed.on_conflict,
        overlapCount: Array.isArray(parsed.entries) ? parsed.entries.length : undefined,
      };
    }
    return {
      status: "fail",
      expected: false,
      reason: "error",
      message: text.replace(/\s+/g, " ").slice(0, 300),
    };
  } catch {
    return {
      status: "fail",
      expected: false,
      reason: "unparsed",
      message: text.replace(/\s+/g, " ").slice(0, 300),
    };
  }
}

function resolveDescription(
  method: "timer" | "manual" | "automated",
  input: {
    description?: string;
    issue_number?: string | number;
    issue_title?: string;
    github_label?: string;
  },
  configRoot?: string,
): string | undefined {
  const loaded = loadConfig(configRoot);
  const repo = resolveRepoName(loaded.root) ?? undefined;
  return resolveEntryDescription(
    loaded.config.entry_methods[method].description,
    {
    ...input,
    repo,
  });
}

function overlapError(
  onConflict: "prompt" | "override",
  overlaps: ClockifyTimeEntry[],
) {
  return {
    isError: true,
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(
          {
            overlap: true,
            on_conflict: onConflict,
            message:
              "Proposed interval overlaps existing time entries. Retry with confirm_overlap: true to write anyway, or choose different times.",
            entries: overlaps.map((entry) => ({
              id: entry.id,
              description: entry.description,
              start: entry.timeInterval.start,
              end: entry.timeInterval.end,
            })),
          },
          null,
          2,
        ),
      },
    ],
  };
}

async function loadEntriesAround(
  api: ClockifyClient,
  workspaceId: string | undefined,
  start: string,
  end: string,
): Promise<ClockifyTimeEntry[]> {
  const windowStart = new Date(
    Math.min(new Date(start).getTime(), new Date(startOfLocalDayIso()).getTime()),
  ).toISOString();
  const windowEnd = new Date(
    Math.max(new Date(end).getTime(), new Date(endOfLocalDayIso()).getTime()),
  ).toISOString();
  return api.listTimeEntries({
    workspaceId,
    start: windowStart,
    end: windowEnd,
    pageSize: 200,
  });
}

const server = new McpServer({
  name: "Clockify",
  version: "0.1.0",
});

function registerClockifyTool(
  name: string,
  config: object,
  // SDK tool callbacks are overloaded; do not contextual-type handler args.
  handler: (args: any, extra?: any) => unknown,
): void {
  const run = handler as (args: object, extra?: object) => unknown;
  (
    server.registerTool as (
      n: string,
      c: object,
      h: (args: object, extra?: object) => unknown,
    ) => void
  )(name, config, async (args: object, extra?: object) => {
    const started = Date.now();
    log.info("tool_start", { tool: name });
    try {
      const result = (await run(args, extra)) as {
        isError?: boolean;
        content?: Array<{ type: string; text?: string }>;
      };
      const fields = toolEndFields(result);
      const line = { tool: name, ms: Date.now() - started, ...fields };
      if (result.isError && fields.expected !== true) {
        log.error("tool_end", line);
      } else {
        log.info("tool_end", line);
      }
      return result;
    } catch (error) {
      log.error("tool_throw", {
        tool: name,
        ms: Date.now() - started,
        err: formatLogError(error),
      });
      throw error;
    }
  });
}

registerClockifyTool(
  "clockify_get_config",
  {
    title: "Get project Clockify config",
    description:
      "Returns the effective .clockify/config.yml standards (per-method description, task, rounding, overlap, automation)." +
      CONFIG_ROOT_TOOL_HINT,
    inputSchema: {
      config_root: configRootField,
    },
  },
  async ({ config_root }) => {
    try {
      const loaded = loadConfig(config_root);
      return textResult({
        found: loaded.found,
        path: loaded.path,
        root: loaded.root,
        projectName: resolveProjectName(loaded.config, loaded.root),
        repoName: resolveRepoName(loaded.root),
        workspaceId:
          resolveConfiguredWorkspaceId(loaded.config, loaded.found) ?? null,
        config: loaded.config,
        tried: loaded.found ? undefined : describeConfigDiscovery(config_root),
        hint: loaded.found
          ? undefined
          : configMissPayload(loaded, config_root).hint,
      });
    } catch (error) {
      return errorResult(error);
    }
  },
);

registerClockifyTool(
  "clockify_get_user",
  {
    title: "Get Clockify user",
    description:
      "Returns the authenticated Clockify user, including active and default workspace IDs." +
      CONFIG_ROOT_TOOL_HINT,
    inputSchema: {
      config_root: configRootField,
    },
  },
  async ({ config_root }) => {
    try {
      return textResult(await client(config_root).getUser());
    } catch (error) {
      return errorResult(error);
    }
  },
);

registerClockifyTool(
  "clockify_list_workspaces",
  {
    title: "List Clockify workspaces",
    description:
      "Lists workspaces available to the authenticated user." +
      CONFIG_ROOT_TOOL_HINT,
    inputSchema: {
      config_root: configRootField,
    },
  },
  async ({ config_root }) => {
    try {
      return textResult(await client(config_root).listWorkspaces());
    } catch (error) {
      return errorResult(error);
    }
  },
);

registerClockifyTool(
  "clockify_list_projects",
  {
    title: "List Clockify projects",
    description:
      "Lists projects in a workspace. Use to map a git repo or task to a Clockify project." +
      CONFIG_ROOT_TOOL_HINT,
    inputSchema: {
      config_root: configRootField,
      workspace_id: workspaceIdField,
      name: z.string().optional().describe("Optional project name filter."),
      archived: z
        .boolean()
        .optional()
        .describe("Include archived projects when true."),
    },
  },
  async ({ config_root, workspace_id, name, archived }) => {
    try {
      return textResult(
        await client(config_root).listProjects(workspace_id, { name, archived }),
      );
    } catch (error) {
      return errorResult(error);
    }
  },
);

registerClockifyTool(
  "clockify_list_clients",
  {
    title: "List Clockify clients",
    description:
      "Lists active (unarchived) clients in a workspace. Call before the init client AskQuestion; each returned name becomes a picker option between None and Create Client." +
      CONFIG_ROOT_TOOL_HINT,
    inputSchema: {
      config_root: configRootField,
      workspace_id: workspaceIdField,
    },
  },
  async ({ config_root, workspace_id }) => {
    try {
      return textResult(await client(config_root).listClients(workspace_id));
    } catch (error) {
      return errorResult(error);
    }
  },
);

registerClockifyTool(
  "clockify_create_client",
  {
    title: "Create Clockify client",
    description:
      "Creates a client in a workspace (init Create Client path — name comes from chat, not AskQuestion)." +
      CONFIG_ROOT_TOOL_HINT,
    inputSchema: {
      config_root: configRootField,
      name: z.string().describe("Client name."),
      workspace_id: workspaceIdField,
    },
  },
  async ({ config_root, name, workspace_id }) => {
    try {
      return textResult(
        await client(config_root).createClient(name.trim(), workspace_id),
      );
    } catch (error) {
      return errorResult(error);
    }
  },
);

registerClockifyTool(
  "clockify_set_project_client",
  {
    title: "Set Clockify project client",
    description:
      "Assigns a client to an existing project (PUT with full project body). Use when init finds a project without a client. Fails if the project already has a client." +
      CONFIG_ROOT_TOOL_HINT,
    inputSchema: {
      config_root: configRootField,
      project_id: z
        .string()
        .trim()
        .min(1)
        .describe("Clockify project id from clockify_list_projects."),
      client_id: z
        .string()
        .trim()
        .min(1)
        .describe("Clockify client id from clockify_list_clients or clockify_create_client."),
      workspace_id: workspaceIdField,
    },
  },
  async ({ config_root, project_id, client_id, workspace_id }) => {
    try {
      return textResult(
        await client(config_root).setProjectClient(
          project_id,
          client_id,
          workspace_id,
        ),
      );
    } catch (error) {
      return errorResult(error);
    }
  },
);

registerClockifyTool(
  "clockify_ensure_project",
  {
    title: "Ensure Clockify project",
    description:
      "Finds a project by name or creates it. Defaults to the repo name from .clockify/config.yml / folder when name omitted." +
      CONFIG_ROOT_TOOL_HINT,
    inputSchema: {
      config_root: configRootField,
      name: z
        .string()
        .optional()
        .describe("Project name. Defaults from .clockify/config.yml / repo folder."),
      workspace_id: workspaceIdField,
      client_id: z
        .string()
        .optional()
        .describe(
          "Clockify client id. Applied on create. On an existing project, prefer clockify_set_project_client instead of set_client.",
        ),
      set_client: z
        .boolean()
        .optional()
        .describe(
          "Deprecated for init: use clockify_set_project_client on existing projects. If true, PUT client_id via full project update when the project exists without a client.",
        ),
    },
  },
  async ({ config_root, name, workspace_id, client_id, set_client }) => {
    try {
      const loaded = loadConfig(config_root);
      const resolved =
        name?.trim() || resolveProjectName(loaded.config, loaded.root);
      if (!name?.trim() && !loaded.found) {
        return configMissResult(loaded, config_root);
      }
      if (!resolved) {
        throw new Error(
          "Project name required (pass name, or add .clockify/config.yml / pass config_root).",
        );
      }
      return textResult(
        await client(config_root).ensureProject(resolved, workspace_id, {
          clientId: client_id,
          setClient: set_client,
        }),
      );
    } catch (error) {
      return errorResult(error);
    }
  },
);

registerClockifyTool(
  "clockify_list_tags",
  {
    title: "List Clockify tags",
    description:
      "Lists tags available in a workspace." + CONFIG_ROOT_TOOL_HINT,
    inputSchema: {
      config_root: configRootField,
      workspace_id: workspaceIdField,
    },
  },
  async ({ config_root, workspace_id }) => {
    try {
      return textResult(await client(config_root).listTags(workspace_id));
    } catch (error) {
      return errorResult(error);
    }
  },
);

registerClockifyTool(
  "clockify_list_tasks",
  {
    title: "List Clockify tasks",
    description:
      "Lists tasks for a project (often mapped 1:1 to GitHub labels)." +
      CONFIG_ROOT_TOOL_HINT,
    inputSchema: {
      config_root: configRootField,
      project_id: z.string().describe("Clockify project ID."),
      workspace_id: workspaceIdField,
    },
  },
  async ({ config_root, project_id, workspace_id }) => {
    try {
      return textResult(
        await client(config_root).listTasks(project_id, workspace_id),
      );
    } catch (error) {
      return errorResult(error);
    }
  },
);

registerClockifyTool(
  "clockify_ensure_task",
  {
    title: "Ensure Clockify task",
    description:
      "Finds a task by name under a project or creates it (e.g. sync a GitHub label)." +
      CONFIG_ROOT_TOOL_HINT,
    inputSchema: {
      config_root: configRootField,
      project_id: z.string().describe("Clockify project ID."),
      name: z.string().describe("Task name (e.g. GitHub label name)."),
      workspace_id: workspaceIdField,
    },
  },
  async ({ config_root, project_id, name, workspace_id }) => {
    try {
      return textResult(
        await client(config_root).ensureTask(project_id, name, workspace_id),
      );
    } catch (error) {
      return errorResult(error);
    }
  },
);

registerClockifyTool(
  "clockify_get_running_timer",
  {
    title: "Get running timer",
    description:
      "Returns the currently running timer for the user, if any. Includes inactivity hint from .clockify/config.yml when configured." +
      CONFIG_ROOT_TOOL_HINT,
    inputSchema: {
      config_root: configRootField,
      workspace_id: workspaceIdField,
    },
  },
  async ({ config_root, workspace_id }) => {
    try {
      const running = await client(config_root).getRunningTimer(workspace_id);
      if (!running) return textResult({ running: false });
      const loaded = loadConfig(config_root);
      const inactivity = loaded.config.entry_methods.automated.inactivity;
      const pastInactivity = isTimerPastInactivity(
        running.timeInterval.start,
        inactivity,
      );
      return textResult({
        ...running,
        inactivity: {
          enabled: inactivity.enabled,
          stop_after_minutes: inactivity.stop_after_minutes,
          pastThreshold: pastInactivity,
          recommendation: pastInactivity
            ? "Timer exceeded inactivity threshold - stop it (or ask the user) per .clockify/config.yml."
            : undefined,
        },
      });
    } catch (error) {
      return errorResult(error);
    }
  },
);

registerClockifyTool(
  "clockify_start_timer",
  {
    title: "Start timer",
    description:
      "Starts a new running timer. Optional start (ISO-8601) backdates the timer; omit for now. entry_method selects timer vs automated config (include_seconds, start rounding, overlap). Prefer stopping any existing timer first. When description.from is template, pass issue_number/issue_title if description is omitted." +
      CONFIG_ROOT_TOOL_HINT,
    inputSchema: {
      config_root: configRootField,
      workspace_id: workspaceIdField,
      start: z
        .string()
        .optional()
        .describe("ISO-8601 start. Omit to start now. Used for backdated or rounded starts."),
      entry_method: z
        .enum(["timer", "automated"])
        .optional()
        .describe("Config block to honor. Default timer."),
      confirm_overlap: z
        .boolean()
        .optional()
        .describe("Write even when the start falls inside an existing completed entry."),
      description: z
        .string()
        .optional()
        .describe("What you are working on. Overrides the description template."),
      issue_number: z
        .union([z.string(), z.number()])
        .optional()
        .describe("GitHub issue number for description template."),
      issue_title: z
        .string()
        .optional()
        .describe("GitHub issue title for description template."),
      github_label: z
        .string()
        .optional()
        .describe("GitHub label name (also usable in template)."),
      project_id: z.string().optional().describe("Clockify project ID."),
      task_id: z.string().optional().describe("Clockify task ID."),
      tag_ids: z.array(z.string()).optional().describe("Tag IDs to attach."),
      billable: z.boolean().optional().describe("Mark entry billable."),
    },
  },
  async ({
    config_root,
    workspace_id,
    start,
    entry_method,
    confirm_overlap,
    description,
    issue_number,
    issue_title,
    github_label,
    project_id,
    task_id,
    tag_ids,
    billable,
  }) => {
    try {
      const loaded = loadConfig(config_root);
      if (!loaded.found) {
        return configMissResult(loaded, config_root);
      }
      const method: TimerEntryMethod = entry_method ?? "timer";
      const block = loaded.config.entry_methods[method];
      const resolvedDescription = resolveDescription(
        method,
        {
          description,
          issue_number,
          issue_title,
          github_label,
        },
        config_root,
      );
      const prepared = prepareStartInstant(
        start ?? new Date().toISOString(),
        block.include_seconds,
        block.rounding,
      );
      const api = client(config_root);
      const nearby = await loadEntriesAround(
        api,
        workspace_id,
        prepared.start,
        new Date().toISOString(),
      );
      const fitted = gapFitStart(prepared.start, latestCompletedEnd(nearby));
      const startIso = fitted.start;
      const probeEnd = new Date(new Date(startIso).getTime() + 1).toISOString();
      const overlaps = completedOverlaps(
        startIso,
        probeEnd,
        nearby,
      ) as ClockifyTimeEntry[];
      if (
        !overlapShouldProceed(
          block.overlap.on_conflict,
          overlaps.length,
          confirm_overlap,
        )
      ) {
        return overlapError(block.overlap.on_conflict, overlaps);
      }
      return textResult({
        entry: await api.startTimer({
          workspaceId: workspace_id,
          start: startIso,
          description: resolvedDescription,
          projectId: project_id,
          taskId: task_id,
          tagIds: tag_ids,
          billable,
        }),
        start: {
          raw: prepared.raw,
          secondsFloored: prepared.secondsFloored,
          roundingApplied: prepared.roundingApplied,
          gapFit: fitted.fitted,
          used: startIso,
        },
      });
    } catch (error) {
      return errorResult(error);
    }
  },
);

registerClockifyTool(
  "clockify_stop_timer",
  {
    title: "Stop timer",
    description:
      "Stops the currently running timer. Honors entry_method rounding (end only), include_seconds, and overlap.on_conflict." +
      CONFIG_ROOT_TOOL_HINT,
    inputSchema: {
      config_root: configRootField,
      workspace_id: workspaceIdField,
      entry_method: z
        .enum(["timer", "automated"])
        .optional()
        .describe("Config block to honor. Default timer."),
      confirm_overlap: z
        .boolean()
        .optional()
        .describe("Write even when the stopped interval overlaps another entry."),
      apply_rounding: z
        .boolean()
        .optional()
        .describe("Override config rounding (default: use the entry_method block)."),
    },
  },
  async ({
    config_root,
    workspace_id,
    entry_method,
    confirm_overlap,
    apply_rounding,
  }) => {
    try {
      const loaded = loadConfig(config_root);
      if (!loaded.found) {
        return configMissResult(loaded, config_root);
      }
      const api = client(config_root);
      const running = await api.getRunningTimer(workspace_id);
      if (!running) {
        throw new ClockifyError(
          "No running timer to stop. Start one with clockify_start_timer first.",
          404,
          "",
        );
      }

      const method: TimerEntryMethod = entry_method ?? "timer";
      const block = loaded.config.entry_methods[method];
      const rounding = {
        ...block.rounding,
        enabled: apply_rounding ?? block.rounding.enabled,
      };
      let endIso = new Date().toISOString();
      if (!block.include_seconds) {
        endIso = floorToMinute(endIso);
      }
      const stopped = applyStopRounding(
        running.timeInterval.start,
        endIso,
        rounding,
      );
      const nearby = await loadEntriesAround(
        api,
        workspace_id,
        running.timeInterval.start,
        stopped.end,
      );
      const overlaps = completedOverlaps(
        running.timeInterval.start,
        stopped.end,
        nearby,
        running.id,
      ) as ClockifyTimeEntry[];
      if (
        !overlapShouldProceed(
          block.overlap.on_conflict,
          overlaps.length,
          confirm_overlap,
        )
      ) {
        return overlapError(block.overlap.on_conflict, overlaps);
      }

      const entry = await api.stopTimer(workspace_id, stopped.end);
      return textResult({
        entry,
        rounding: {
          applied: stopped.applied,
          mode: rounding.stop_mode ?? rounding.mode,
          increment_minutes: rounding.increment_minutes,
          minimum_minutes: rounding.minimum_minutes,
          rawEnd: stopped.rawEnd,
          end: stopped.end,
        },
      });
    } catch (error) {
      return errorResult(error);
    }
  },
);

registerClockifyTool(
  "clockify_create_time_entry",
  {
    title: "Create time entry",
    description:
      "Creates a completed time entry with explicit start and end (ISO-8601). Never rounds. entry_method selects manual vs automated description/overlap. When overlap.on_conflict is prompt, retry with confirm_overlap: true to stack intervals." +
      CONFIG_ROOT_TOOL_HINT,
    inputSchema: {
      config_root: configRootField,
      start: z.string().describe("Start time in ISO-8601 / yyyy-MM-ddThh:mm:ssZ."),
      end: z.string().describe("End time in ISO-8601 / yyyy-MM-ddThh:mm:ssZ."),
      workspace_id: workspaceIdField,
      entry_method: z
        .enum(["manual", "automated"])
        .optional()
        .describe("Config block to honor. Default manual."),
      confirm_overlap: z
        .boolean()
        .optional()
        .describe("Write even when the interval overlaps another entry."),
      description: z.string().optional().describe("Entry description."),
      issue_number: z.union([z.string(), z.number()]).optional(),
      issue_title: z.string().optional(),
      github_label: z.string().optional(),
      project_id: z.string().optional().describe("Clockify project ID."),
      task_id: z.string().optional().describe("Clockify task ID."),
      tag_ids: z.array(z.string()).optional().describe("Tag IDs to attach."),
      billable: z.boolean().optional().describe("Mark entry billable."),
    },
  },
  async ({
    config_root,
    start,
    end,
    workspace_id,
    entry_method,
    confirm_overlap,
    description,
    issue_number,
    issue_title,
    github_label,
    project_id,
    task_id,
    tag_ids,
    billable,
  }) => {
    try {
      const loaded = loadConfig(config_root);
      if (!loaded.found) {
        return configMissResult(loaded, config_root);
      }
      const method = (entry_method ?? "manual") as EntryMethod;
      const onConflict = loaded.config.entry_methods[method].overlap.on_conflict;
      const resolvedDescription = resolveDescription(
        method,
        {
          description,
          issue_number,
          issue_title,
          github_label,
        },
        config_root,
      );
      const api = client(config_root);
      const nearby = await loadEntriesAround(api, workspace_id, start, end);
      const overlaps = completedOverlaps(
        start,
        end,
        nearby,
      ) as ClockifyTimeEntry[];
      if (!overlapShouldProceed(onConflict, overlaps.length, confirm_overlap)) {
        return overlapError(onConflict, overlaps);
      }

      const entry = await api.createTimeEntry({
        start,
        end,
        workspaceId: workspace_id,
        description: resolvedDescription,
        projectId: project_id,
        taskId: task_id,
        tagIds: tag_ids,
        billable,
      });
      return textResult({ entry });
    } catch (error) {
      return errorResult(error);
    }
  },
);

registerClockifyTool(
  "clockify_list_time_entries",
  {
    title: "List time entries",
    description:
      "Lists recent time entries for the authenticated user." +
      CONFIG_ROOT_TOOL_HINT,
    inputSchema: {
      config_root: configRootField,
      workspace_id: workspaceIdField,
      start: z.string().optional().describe("Filter start (ISO-8601)."),
      end: z.string().optional().describe("Filter end (ISO-8601)."),
      page_size: z.number().int().min(1).max(200).optional(),
    },
  },
  async ({ config_root, workspace_id, start, end, page_size }) => {
    try {
      return textResult(
        await client(config_root).listTimeEntries({
          workspaceId: workspace_id,
          start,
          end,
          pageSize: page_size,
        }),
      );
    } catch (error) {
      return errorResult(error);
    }
  },
);

registerClockifyTool(
  "clockify_today_summary",
  {
    title: "Today summary",
    description:
      "Summarizes today's tracked time: total duration, entry count, and per-project totals." +
      CONFIG_ROOT_TOOL_HINT,
    inputSchema: {
      config_root: configRootField,
      workspace_id: workspaceIdField,
    },
  },
  async ({ config_root, workspace_id }) => {
    try {
      const api = client(config_root);
      const entries = await api.listTimeEntries({
        workspaceId: workspace_id,
        start: startOfLocalDayIso(),
        end: endOfLocalDayIso(),
        pageSize: 200,
      });

      const projects = await api.listProjects(workspace_id);
      const projectName = new Map(projects.map((p) => [p.id, p.name]));

      const byProject = new Map<string, number>();
      let totalSeconds = 0;

      for (const entry of entries) {
        const { timeInterval } = entry;
        let seconds = parseDurationSeconds(timeInterval.duration);
        if (!seconds && timeInterval.start) {
          const end = timeInterval.end
            ? new Date(timeInterval.end).getTime()
            : Date.now();
          seconds = Math.max(
            0,
            Math.floor((end - new Date(timeInterval.start).getTime()) / 1000),
          );
        }
        totalSeconds += seconds;
        const key = entry.projectId ?? "(no project)";
        byProject.set(key, (byProject.get(key) ?? 0) + seconds);
      }

      const perProject = [...byProject.entries()]
        .map(([id, seconds]) => ({
          projectId: id === "(no project)" ? null : id,
          projectName:
            id === "(no project)" ? null : (projectName.get(id) ?? id),
          seconds,
          duration: formatDuration(seconds),
        }))
        .sort((a, b) => b.seconds - a.seconds);

      return textResult({
        date: new Date().toISOString().slice(0, 10),
        entryCount: entries.length,
        totalSeconds,
        totalDuration: formatDuration(totalSeconds),
        perProject,
        entries,
      });
    } catch (error) {
      return errorResult(error);
    }
  },
);

async function main() {
  installProcessLogHandlers();
  const ready: Record<string, unknown> = {
    pid: process.pid,
    version: log.version,
    log: log.level,
    transport: "stdio",
  };
  if (process.env.CLOCKIFY_MCP_SANDBOX === "1") {
    ready.sandbox = true;
  }
  log.info("ready", ready);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  log.info("connected");
}

main().catch((error) => {
  log.error("fatal", { err: formatLogError(error) });
  process.exit(1);
});
