const API_BASE = "https://api.clockify.me/api/v1";

export type ClockifyUser = {
  id: string;
  name: string;
  email: string;
  activeWorkspace: string;
  defaultWorkspace: string;
};

export type ClockifyWorkspace = {
  id: string;
  name: string;
};

export type ClockifyProject = {
  id: string;
  name: string;
  clientName?: string;
  archived?: boolean;
};

export type ClockifyTag = {
  id: string;
  name: string;
};

export type ClockifyTask = {
  id: string;
  name: string;
  projectId: string;
  status?: string;
};

export type TimeInterval = {
  start: string;
  end: string | null;
  duration: string | null;
};

export type ClockifyTimeEntry = {
  id: string;
  description?: string;
  projectId?: string | null;
  taskId?: string | null;
  tagIds?: string[];
  userId: string;
  workspaceId: string;
  billable?: boolean;
  timeInterval: TimeInterval;
};

export class ClockifyError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: string,
  ) {
    super(message);
    this.name = "ClockifyError";
  }
}

function formatApiError(status: number, body: string): string {
  const detail = body.trim();
  switch (status) {
    case 401:
    case 403:
      return `Clockify authentication failed (${status}). Check CLOCKIFY_API_KEY - see docs/use.md → Credentials.${detail ? ` Details: ${detail}` : ""}`;
    case 429:
      return `Clockify rate limit exceeded (429). Wait a moment and retry.${detail ? ` Details: ${detail}` : ""}`;
    default:
      return `Clockify API ${status}: ${detail || "request failed"}`;
  }
}

export class ClockifyClient {
  constructor(
    private readonly apiKey: string,
    private readonly defaultWorkspaceId?: string,
  ) {}

  private async request<T>(
    path: string,
    init: RequestInit = {},
  ): Promise<T> {
    const response = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        "X-Api-Key": this.apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(init.headers ?? {}),
      },
    });

    const text = await response.text();
    if (!response.ok) {
      throw new ClockifyError(
        formatApiError(response.status, text || response.statusText),
        response.status,
        text,
      );
    }

    if (!text) {
      return undefined as T;
    }

    return JSON.parse(text) as T;
  }

  getUser(): Promise<ClockifyUser> {
    return this.request<ClockifyUser>("/user");
  }

  listWorkspaces(): Promise<ClockifyWorkspace[]> {
    return this.request<ClockifyWorkspace[]>("/workspaces");
  }

  async resolveWorkspaceId(explicit?: string): Promise<string> {
    let candidate = explicit || this.defaultWorkspaceId;
    if (!candidate) {
      const user = await this.getUser();
      candidate = user.activeWorkspace || user.defaultWorkspace;
    }

    if (!candidate) {
      throw new ClockifyError(
        "No Clockify workspace available. Set workspace_id in .clockify/config.yml, CLOCKIFY_WORKSPACE_ID, or create a workspace.",
        400,
        "",
      );
    }

    // Validate configured IDs early — a typo in workspace_id / CLOCKIFY_WORKSPACE_ID
    // is easy when copying from the browser URL and produces opaque 404s later.
    if (explicit || this.defaultWorkspaceId) {
      const workspaces = await this.listWorkspaces();
      if (!workspaces.some((w) => w.id === candidate)) {
        const known = workspaces.map((w) => `${w.name} (${w.id})`).join(", ");
        throw new ClockifyError(
          `Workspace ID "${candidate}" was not found for this API key. Known workspaces: ${known || "(none)"}. Copy the ID from the workspace URL: /workspaces/{id}/…`,
          404,
          "",
        );
      }
    }

    return candidate;
  }

  async listProjects(
    workspaceId?: string,
    options: { archived?: boolean; name?: string } = {},
  ): Promise<ClockifyProject[]> {
    const ws = await this.resolveWorkspaceId(workspaceId);
    const params = new URLSearchParams();
    if (options.archived !== undefined) {
      params.set("archived", String(options.archived));
    }
    if (options.name) {
      params.set("name", options.name);
    }
    params.set("page-size", "200");
    const query = params.toString();
    return this.request<ClockifyProject[]>(
      `/workspaces/${ws}/projects${query ? `?${query}` : ""}`,
    );
  }

  async listTags(workspaceId?: string): Promise<ClockifyTag[]> {
    const ws = await this.resolveWorkspaceId(workspaceId);
    return this.request<ClockifyTag[]>(`/workspaces/${ws}/tags`);
  }

  async getRunningTimer(
    workspaceId?: string,
  ): Promise<ClockifyTimeEntry | null> {
    const user = await this.getUser();
    const ws = await this.resolveWorkspaceId(workspaceId);
    const entries = await this.request<ClockifyTimeEntry[]>(
      `/workspaces/${ws}/user/${user.id}/time-entries?in-progress=true&page-size=1`,
    );
    return entries[0] ?? null;
  }

  async startTimer(input: {
    workspaceId?: string;
    start?: string;
    description?: string;
    projectId?: string;
    taskId?: string;
    tagIds?: string[];
    billable?: boolean;
  }): Promise<ClockifyTimeEntry> {
    const user = await this.getUser();
    const ws = await this.resolveWorkspaceId(input.workspaceId);
    await this.assertProjectInWorkspace(ws, input.projectId);
    const body: Record<string, unknown> = {
      start: input.start ?? new Date().toISOString(),
    };
    if (input.description !== undefined) body.description = input.description;
    if (input.projectId !== undefined) body.projectId = input.projectId;
    if (input.taskId !== undefined) body.taskId = input.taskId;
    if (input.tagIds !== undefined) body.tagIds = input.tagIds;
    if (input.billable !== undefined) body.billable = input.billable;

    return this.request<ClockifyTimeEntry>(
      `/workspaces/${ws}/user/${user.id}/time-entries`,
      {
        method: "POST",
        body: JSON.stringify(body),
      },
    );
  }

  async stopTimer(
    workspaceId?: string,
    endIso?: string,
  ): Promise<ClockifyTimeEntry> {
    const user = await this.getUser();
    const ws = await this.resolveWorkspaceId(workspaceId);
    const running = await this.getRunningTimer(ws);
    if (!running) {
      throw new ClockifyError(
        "No running timer to stop. Start one with clockify_start_timer first.",
        404,
        "",
      );
    }
    return this.request<ClockifyTimeEntry>(
      `/workspaces/${ws}/user/${user.id}/time-entries`,
      {
        method: "PATCH",
        body: JSON.stringify({ end: endIso ?? new Date().toISOString() }),
      },
    );
  }

  async createTimeEntry(input: {
    workspaceId?: string;
    start: string;
    end: string;
    description?: string;
    projectId?: string;
    taskId?: string;
    tagIds?: string[];
    billable?: boolean;
  }): Promise<ClockifyTimeEntry> {
    const ws = await this.resolveWorkspaceId(input.workspaceId);
    await this.assertProjectInWorkspace(ws, input.projectId);
    const body: Record<string, unknown> = {
      start: input.start,
      end: input.end,
    };
    if (input.description !== undefined) body.description = input.description;
    if (input.projectId !== undefined) body.projectId = input.projectId;
    if (input.taskId !== undefined) body.taskId = input.taskId;
    if (input.tagIds !== undefined) body.tagIds = input.tagIds;
    if (input.billable !== undefined) body.billable = input.billable;

    return this.request<ClockifyTimeEntry>(`/workspaces/${ws}/time-entries`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  async listTimeEntries(input: {
    workspaceId?: string;
    start?: string;
    end?: string;
    pageSize?: number;
  }): Promise<ClockifyTimeEntry[]> {
    const user = await this.getUser();
    const ws = await this.resolveWorkspaceId(input.workspaceId);
    const params = new URLSearchParams();
    params.set("page-size", String(input.pageSize ?? 50));
    if (input.start) params.set("start", input.start);
    if (input.end) params.set("end", input.end);
    return this.request<ClockifyTimeEntry[]>(
      `/workspaces/${ws}/user/${user.id}/time-entries?${params}`,
    );
  }

  async createProject(
    name: string,
    workspaceId?: string,
  ): Promise<ClockifyProject> {
    const ws = await this.resolveWorkspaceId(workspaceId);
    return this.request<ClockifyProject>(`/workspaces/${ws}/projects`, {
      method: "POST",
      body: JSON.stringify({ name }),
    });
  }

  async ensureProject(
    name: string,
    workspaceId?: string,
  ): Promise<{ project: ClockifyProject; created: boolean }> {
    const existing = await this.listProjects(workspaceId, { name });
    const match = existing.find(
      (p) => p.name.toLowerCase() === name.toLowerCase(),
    );
    if (match) return { project: match, created: false };
    const project = await this.createProject(name, workspaceId);
    return { project, created: true };
  }

  async listTasks(
    projectId: string,
    workspaceId?: string,
  ): Promise<ClockifyTask[]> {
    const ws = await this.resolveWorkspaceId(workspaceId);
    await this.assertProjectInWorkspace(ws, projectId);
    return this.request<ClockifyTask[]>(
      `/workspaces/${ws}/projects/${projectId}/tasks?page-size=200`,
    );
  }

  async createTask(
    projectId: string,
    name: string,
    workspaceId?: string,
  ): Promise<ClockifyTask> {
    const ws = await this.resolveWorkspaceId(workspaceId);
    await this.assertProjectInWorkspace(ws, projectId);
    return this.request<ClockifyTask>(
      `/workspaces/${ws}/projects/${projectId}/tasks`,
      {
        method: "POST",
        body: JSON.stringify({ name }),
      },
    );
  }

  async ensureTask(
    projectId: string,
    name: string,
    workspaceId?: string,
  ): Promise<{ task: ClockifyTask; created: boolean }> {
    const tasks = await this.listTasks(projectId, workspaceId);
    const match = tasks.find((t) => t.name.toLowerCase() === name.toLowerCase());
    if (match) return { task: match, created: false };
    const task = await this.createTask(projectId, name, workspaceId);
    return { task, created: true };
  }

  private async assertProjectInWorkspace(
    workspaceId: string,
    projectId?: string,
  ): Promise<void> {
    if (!projectId) return;
    const projects = await this.listProjects(workspaceId);
    if (projects.some((p) => p.id === projectId)) return;
    const known =
      projects.map((p) => `${p.name} (${p.id})`).join(", ") || "(none)";
    throw new ClockifyError(
      `Project ID "${projectId}" was not found in this workspace. Known projects: ${known}. Call clockify_list_projects and use a returned id (do not invent ids).`,
      404,
      "",
    );
  }
}

export function parseDurationSeconds(
  duration: string | null | undefined,
): number {
  if (!duration) return 0;
  // ISO-8601 duration PT1H2M3S or Clockify sometimes returns seconds as string number
  if (/^\d+$/.test(duration)) {
    return Number(duration);
  }
  const match = duration.match(
    /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?$/i,
  );
  if (!match) return 0;
  const hours = Number(match[1] ?? 0);
  const minutes = Number(match[2] ?? 0);
  const seconds = Number(match[3] ?? 0);
  return hours * 3600 + minutes * 60 + seconds;
}

export function formatDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const parts: string[] = [];
  if (hours) parts.push(`${hours}h`);
  if (minutes || hours) parts.push(`${minutes}m`);
  parts.push(`${seconds}s`);
  return parts.join(" ");
}

export function startOfLocalDayIso(date = new Date()): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export function endOfLocalDayIso(date = new Date()): string {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
}
