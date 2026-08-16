#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  ClockifyClient,
  ClockifyError,
  endOfLocalDayIso,
  formatDuration,
  parseDurationSeconds,
  startOfLocalDayIso,
} from "./clockify-client.js";
import {
  applyRoundingToInterval,
  isTimerPastInactivity,
  loadClockifyConfig,
  resolveEntryDescription,
  resolveProjectName,
} from "./config.js";

function requireApiKey(): string {
  const key = process.env.CLOCKIFY_API_KEY?.trim();
  if (!key) {
    throw new Error(
      "CLOCKIFY_API_KEY is required. See README Setup → Clockify credentials, then set it in your MCP config (or .env via envFile).",
    );
  }
  return key;
}

function client(): ClockifyClient {
  return new ClockifyClient(
    requireApiKey(),
    process.env.CLOCKIFY_WORKSPACE_ID?.trim() || undefined,
  );
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
  return {
    isError: true,
    content: [{ type: "text" as const, text: message }],
  };
}

function resolveDescription(
  method: "timer" | "manual" | "automated",
  input: {
    description?: string;
    issue_number?: string | number;
    issue_title?: string;
    github_label?: string;
  },
): string | undefined {
  const loaded = loadClockifyConfig();
  const repo = resolveProjectName(loaded.config, loaded.root) ?? undefined;
  return resolveEntryDescription(loaded.config[method].description, {
    ...input,
    repo,
  });
}

const server = new McpServer({
  name: "Clockify",
  version: "0.1.0",
});

server.registerTool(
  "clockify_get_config",
  {
    title: "Get project Clockify config",
    description:
      "Returns the effective .clockify/config.yml standards (per-method description, task, rounding, overlap, automation). Set CLOCKIFY_CONFIG_ROOT to the repo root if needed.",
    inputSchema: {},
  },
  async () => {
    try {
      const loaded = loadClockifyConfig();
      return textResult({
        found: loaded.found,
        path: loaded.path,
        root: loaded.root,
        projectName: resolveProjectName(loaded.config, loaded.root),
        config: loaded.config,
        hint: loaded.found
          ? undefined
          : "No .clockify/config.yml found. Add one via clockify-project-init, or set CLOCKIFY_CONFIG_ROOT / CLOCKIFY_CONFIG_PATH.",
      });
    } catch (error) {
      return errorResult(error);
    }
  },
);

server.registerTool(
  "clockify_get_user",
  {
    title: "Get Clockify user",
    description:
      "Returns the authenticated Clockify user, including active and default workspace IDs.",
    inputSchema: {},
  },
  async () => {
    try {
      return textResult(await client().getUser());
    } catch (error) {
      return errorResult(error);
    }
  },
);

server.registerTool(
  "clockify_list_workspaces",
  {
    title: "List Clockify workspaces",
    description: "Lists workspaces available to the authenticated user.",
    inputSchema: {},
  },
  async () => {
    try {
      return textResult(await client().listWorkspaces());
    } catch (error) {
      return errorResult(error);
    }
  },
);

server.registerTool(
  "clockify_list_projects",
  {
    title: "List Clockify projects",
    description:
      "Lists projects in a workspace. Use to map a git repo or task to a Clockify project.",
    inputSchema: {
      workspace_id: z
        .string()
        .optional()
        .describe("Workspace ID. Defaults to CLOCKIFY_WORKSPACE_ID or active workspace."),
      name: z.string().optional().describe("Optional project name filter."),
      archived: z
        .boolean()
        .optional()
        .describe("Include archived projects when true."),
    },
  },
  async ({ workspace_id, name, archived }) => {
    try {
      return textResult(
        await client().listProjects(workspace_id, { name, archived }),
      );
    } catch (error) {
      return errorResult(error);
    }
  },
);

server.registerTool(
  "clockify_ensure_project",
  {
    title: "Ensure Clockify project",
    description:
      "Finds a project by name or creates it. Defaults to the repo name from .clockify/config.yml / folder when name omitted.",
    inputSchema: {
      name: z
        .string()
        .optional()
        .describe("Project name. Defaults from .clockify/config.yml / repo folder."),
      workspace_id: z.string().optional().describe("Workspace ID override."),
    },
  },
  async ({ name, workspace_id }) => {
    try {
      const loaded = loadClockifyConfig();
      const resolved =
        name?.trim() || resolveProjectName(loaded.config, loaded.root);
      if (!resolved) {
        throw new Error(
          "Project name required (pass name, or add .clockify/config.yml / set CLOCKIFY_CONFIG_ROOT).",
        );
      }
      return textResult(await client().ensureProject(resolved, workspace_id));
    } catch (error) {
      return errorResult(error);
    }
  },
);

server.registerTool(
  "clockify_list_tags",
  {
    title: "List Clockify tags",
    description: "Lists tags available in a workspace.",
    inputSchema: {
      workspace_id: z.string().optional().describe("Workspace ID override."),
    },
  },
  async ({ workspace_id }) => {
    try {
      return textResult(await client().listTags(workspace_id));
    } catch (error) {
      return errorResult(error);
    }
  },
);

server.registerTool(
  "clockify_list_tasks",
  {
    title: "List Clockify tasks",
    description: "Lists tasks for a project (often mapped 1:1 to GitHub labels).",
    inputSchema: {
      project_id: z.string().describe("Clockify project ID."),
      workspace_id: z.string().optional().describe("Workspace ID override."),
    },
  },
  async ({ project_id, workspace_id }) => {
    try {
      return textResult(await client().listTasks(project_id, workspace_id));
    } catch (error) {
      return errorResult(error);
    }
  },
);

server.registerTool(
  "clockify_ensure_task",
  {
    title: "Ensure Clockify task",
    description:
      "Finds a task by name under a project or creates it (e.g. sync a GitHub label).",
    inputSchema: {
      project_id: z.string().describe("Clockify project ID."),
      name: z.string().describe("Task name (e.g. GitHub label name)."),
      workspace_id: z.string().optional().describe("Workspace ID override."),
    },
  },
  async ({ project_id, name, workspace_id }) => {
    try {
      return textResult(
        await client().ensureTask(project_id, name, workspace_id),
      );
    } catch (error) {
      return errorResult(error);
    }
  },
);

server.registerTool(
  "clockify_get_running_timer",
  {
    title: "Get running timer",
    description:
      "Returns the currently running timer for the user, if any. Includes inactivity hint from .clockify/config.yml when configured.",
    inputSchema: {
      workspace_id: z.string().optional().describe("Workspace ID override."),
    },
  },
  async ({ workspace_id }) => {
    try {
      const running = await client().getRunningTimer(workspace_id);
      if (!running) return textResult({ running: false });
      const loaded = loadClockifyConfig();
      const inactivity = loaded.config.automated.inactivity;
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

server.registerTool(
  "clockify_start_timer",
  {
    title: "Start timer",
    description:
      "Starts a new running timer. Prefer stopping any existing timer first unless the user wants overlapping entries. When timer.description.from is template, pass issue_number/issue_title so the template applies when description is omitted.",
    inputSchema: {
      workspace_id: z.string().optional().describe("Workspace ID override."),
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
    workspace_id,
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
      const resolvedDescription = resolveDescription("timer", {
        description,
        issue_number,
        issue_title,
        github_label,
      });
      return textResult(
        await client().startTimer({
          workspaceId: workspace_id,
          description: resolvedDescription,
          projectId: project_id,
          taskId: task_id,
          tagIds: tag_ids,
          billable,
        }),
      );
    } catch (error) {
      return errorResult(error);
    }
  },
);

server.registerTool(
  "clockify_stop_timer",
  {
    title: "Stop timer",
    description:
      "Stops the currently running timer. Applies timer.rounding from .clockify/config.yml when enabled.",
    inputSchema: {
      workspace_id: z.string().optional().describe("Workspace ID override."),
      apply_rounding: z
        .boolean()
        .optional()
        .describe("Override config rounding (default: use .clockify/config.yml)."),
    },
  },
  async ({ workspace_id, apply_rounding }) => {
    try {
      const api = client();
      const running = await api.getRunningTimer(workspace_id);
      if (!running) {
        throw new ClockifyError(
          "No running timer to stop. Start one with clockify_start_timer first.",
          404,
          "",
        );
      }

      const loaded = loadClockifyConfig();
      const rounding = loaded.config.timer.rounding;
      const shouldRound = apply_rounding ?? rounding.enabled;
      const rawEnd = new Date().toISOString();
      let endIso = rawEnd;
      let roundingMeta: unknown = { applied: false };

      if (shouldRound) {
        const rounded = applyRoundingToInterval(
          running.timeInterval.start,
          rawEnd,
          {
            ...rounding,
            enabled: true,
          },
        );
        endIso = rounded.end;
        roundingMeta = {
          applied: true,
          mode: rounding.stop_mode ?? rounding.mode,
          increment_minutes: rounding.increment_minutes,
          minimum_minutes: rounding.minimum_minutes,
          raw: rounded.raw,
          rounded: { start: rounded.start, end: rounded.end },
        };
      }

      const entry = await api.stopTimer(workspace_id, endIso);
      return textResult({ entry, rounding: roundingMeta });
    } catch (error) {
      return errorResult(error);
    }
  },
);

server.registerTool(
  "clockify_create_time_entry",
  {
    title: "Create time entry",
    description:
      "Creates a completed time entry with explicit start and end (ISO-8601). Does not round (Manual times are explicit). When manual.description.from is template, pass issue fields so the template applies when description is omitted.",
    inputSchema: {
      start: z.string().describe("Start time in ISO-8601 / yyyy-MM-ddThh:mm:ssZ."),
      end: z.string().describe("End time in ISO-8601 / yyyy-MM-ddThh:mm:ssZ."),
      workspace_id: z.string().optional().describe("Workspace ID override."),
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
    start,
    end,
    workspace_id,
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
      const resolvedDescription = resolveDescription("manual", {
        description,
        issue_number,
        issue_title,
        github_label,
      });

      const entry = await client().createTimeEntry({
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

server.registerTool(
  "clockify_list_time_entries",
  {
    title: "List time entries",
    description: "Lists recent time entries for the authenticated user.",
    inputSchema: {
      workspace_id: z.string().optional().describe("Workspace ID override."),
      start: z.string().optional().describe("Filter start (ISO-8601)."),
      end: z.string().optional().describe("Filter end (ISO-8601)."),
      page_size: z.number().int().min(1).max(200).optional(),
    },
  },
  async ({ workspace_id, start, end, page_size }) => {
    try {
      return textResult(
        await client().listTimeEntries({
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

server.registerTool(
  "clockify_today_summary",
  {
    title: "Today summary",
    description:
      "Summarizes today's tracked time: total duration, entry count, and per-project totals.",
    inputSchema: {
      workspace_id: z.string().optional().describe("Workspace ID override."),
    },
  },
  async ({ workspace_id }) => {
    try {
      const api = client();
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
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
