import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const pkg = require("../package.json") as { version?: string };

export type LogLevel = "debug" | "info" | "error" | "off";

const LEVEL_RANK: Record<Exclude<LogLevel, "off">, number> = {
  debug: 10,
  info: 20,
  error: 30,
};

function parseLevel(raw: string | undefined): LogLevel {
  const value = raw?.trim().toLowerCase();
  if (value === "debug" || value === "info" || value === "error" || value === "off") {
    return value;
  }
  return "info";
}

const activeLevel = parseLevel(process.env.CLOCKIFY_MCP_LOG);

function shouldLog(level: Exclude<LogLevel, "off">): boolean {
  if (activeLevel === "off") return false;
  return LEVEL_RANK[level] >= LEVEL_RANK[activeLevel];
}

function clip(value: string, max = 300): string {
  return value.length <= max ? value : `${value.slice(0, max)}…`;
}

export function formatLogError(error: unknown): {
  name?: string;
  message: string;
  status?: number;
  method?: string;
  path?: string;
} {
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof (error as { message: unknown }).message === "string"
  ) {
    const err = error as {
      name?: string;
      message: string;
      status?: number;
      method?: string;
      path?: string;
    };
    const out: {
      name?: string;
      message: string;
      status?: number;
      method?: string;
      path?: string;
    } = {
      message: clip(err.message),
    };
    if (err.name) out.name = err.name;
    if (typeof err.status === "number") out.status = err.status;
    if (err.method) out.method = err.method;
    if (err.path) out.path = err.path;
    return out;
  }
  return { message: clip(String(error)) };
}

function write(level: Exclude<LogLevel, "off">, msg: string, fields?: Record<string, unknown>) {
  if (!shouldLog(level)) return;
  const line: Record<string, unknown> = {
    ts: new Date().toISOString(),
    level,
    msg,
    ...fields,
  };
  process.stderr.write(`${JSON.stringify(line)}\n`);
}

export const log = {
  level: activeLevel,
  version: typeof pkg.version === "string" ? pkg.version : "unknown",
  debug(msg: string, fields?: Record<string, unknown>) {
    write("debug", msg, fields);
  },
  info(msg: string, fields?: Record<string, unknown>) {
    write("info", msg, fields);
  },
  error(msg: string, fields?: Record<string, unknown>) {
    write("error", msg, fields);
  },
};

export function installProcessLogHandlers(): void {
  process.on("uncaughtException", (error) => {
    log.error("uncaughtException", { err: formatLogError(error) });
    process.exit(1);
  });
  process.on("unhandledRejection", (reason) => {
    log.error("unhandledRejection", { err: formatLogError(reason) });
  });
  process.stdin.on("end", () => {
    log.info("stdin_end");
  });
  process.stdin.on("close", () => {
    log.info("stdin_close");
  });
}
