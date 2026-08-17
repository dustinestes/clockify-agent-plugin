/**
 * Live smoke test against Clockify API.
 * Requires CLOCKIFY_API_KEY (loads .env from repo root when present).
 * Skips with exit 0 if no key is set (CI-friendly).
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ClockifyClient,
  ClockifyError,
  endOfLocalDayIso,
  formatDuration,
  parseDurationSeconds,
  startOfLocalDayIso,
} from "../src/clockify-client.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function loadDotEnv(): void {
  const path = resolve(root, ".env");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function main(): Promise<void> {
  loadDotEnv();
  const apiKey = process.env.CLOCKIFY_API_KEY?.trim();
  if (!apiKey) {
    console.log("SKIP: CLOCKIFY_API_KEY not set");
    return;
  }

  const workspaceId = process.env.CLOCKIFY_WORKSPACE_ID?.trim();
  const client = new ClockifyClient(apiKey, workspaceId);
  const log = (step: string, detail?: unknown) => {
    console.log(`✓ ${step}`);
    if (detail !== undefined) {
      console.log(
        typeof detail === "string" ? detail : JSON.stringify(detail, null, 2),
      );
    }
  };

  console.log(
    `Smoke against workspace: ${workspaceId ?? "(active workspace)"}\n`,
  );

  const user = await client.getUser();
  assert(user.id, "getUser: missing id");
  log("clockify_get_user", {
    id: user.id,
    name: user.name,
    activeWorkspace: user.activeWorkspace,
    defaultWorkspace: user.defaultWorkspace,
  });

  const workspaces = await client.listWorkspaces();
  assert(workspaces.length > 0, "listWorkspaces: empty");
  log(
    "clockify_list_workspaces",
    workspaces.map((w) => ({ id: w.id, name: w.name })),
  );

  if (workspaceId) {
    assert(
      workspaces.some((w) => w.id === workspaceId),
      `CLOCKIFY_WORKSPACE_ID ${workspaceId} not in user's workspaces`,
    );
  }

  const ws = await client.resolveWorkspaceId();
  log("resolveWorkspaceId", ws);

  const projects = await client.listProjects();
  log(
    "clockify_list_projects",
    projects.map((p) => ({ id: p.id, name: p.name })),
  );

  const tags = await client.listTags();
  log(
    "clockify_list_tags",
    tags.map((t) => ({ id: t.id, name: t.name })),
  );

  const before = await client.getRunningTimer();
  log("clockify_get_running_timer (before)", before ?? { running: false });
  if (before) {
    console.log("  → stopping pre-existing timer so smoke can start cleanly");
    await client.stopTimer();
  }

  const projectId = projects[0]?.id;
  const started = await client.startTimer({
    description: "smoke-live: @dustinestes/clockify-agent-plugin",
    projectId,
  });
  assert(started.id, "startTimer: missing id");
  assert(started.timeInterval?.start, "startTimer: missing start");
  assert(!started.timeInterval?.end, "startTimer: should be in progress");
  log("clockify_start_timer", {
    id: started.id,
    description: started.description,
    projectId: started.projectId,
    start: started.timeInterval.start,
  });

  const running = await client.getRunningTimer();
  assert(running?.id === started.id, "getRunningTimer: expected started entry");
  log("clockify_get_running_timer (during)", { id: running.id });

  await new Promise((r) => setTimeout(r, 1500));

  const stopped = await client.stopTimer();
  assert(stopped.id, "stopTimer: missing id");
  assert(stopped.timeInterval?.end, "stopTimer: missing end");
  log("clockify_stop_timer", {
    id: stopped.id,
    start: stopped.timeInterval.start,
    end: stopped.timeInterval.end,
    duration: stopped.timeInterval.duration,
  });

  const afterStop = await client.getRunningTimer();
  assert(!afterStop, "getRunningTimer: expected none after stop");
  log("clockify_get_running_timer (after stop)", { running: false });

  const end = new Date();
  const start = new Date(end.getTime() - 5 * 60 * 1000);
  const created = await client.createTimeEntry({
    start: start.toISOString(),
    end: end.toISOString(),
    description: "smoke-live: backfilled entry",
    projectId,
  });
  assert(created.id, "createTimeEntry: missing id");
  log("clockify_create_time_entry", {
    id: created.id,
    description: created.description,
    start: created.timeInterval.start,
    end: created.timeInterval.end,
  });

  const entries = await client.listTimeEntries({
    start: startOfLocalDayIso(),
    end: endOfLocalDayIso(),
    pageSize: 50,
  });
  assert(entries.length >= 2, "listTimeEntries: expected smoke entries today");
  log("clockify_list_time_entries", {
    count: entries.length,
    sample: entries.slice(0, 3).map((e) => ({
      id: e.id,
      description: e.description,
      duration: e.timeInterval.duration,
    })),
  });

  let totalSeconds = 0;
  for (const entry of entries) {
    let seconds = parseDurationSeconds(entry.timeInterval.duration);
    if (!seconds && entry.timeInterval.start) {
      const endMs = entry.timeInterval.end
        ? new Date(entry.timeInterval.end).getTime()
        : Date.now();
      seconds = Math.max(
        0,
        Math.floor((endMs - new Date(entry.timeInterval.start).getTime()) / 1000),
      );
    }
    totalSeconds += seconds;
  }
  log("clockify_today_summary (rollup)", {
    entryCount: entries.length,
    totalDuration: formatDuration(totalSeconds),
  });

  console.log("\nAll smoke checks passed.");
}

main().catch((error) => {
  if (error instanceof ClockifyError) {
    console.error(`FAIL Clockify ${error.status}: ${error.message}`);
  } else {
    console.error("FAIL", error);
  }
  process.exit(1);
});
