/**
 * MCP initialize handshake against dist/index.js (no Clockify API calls).
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const entry = resolve(root, "dist/index.js");
const node = process.execPath;

if (!existsSync(entry)) {
  console.error("FAIL: dist/index.js missing — run npm run build first");
  process.exit(1);
}

const child = spawn(node, [entry], {
  env: {
    ...process.env,
    // Handshake only; tools are not invoked.
    CLOCKIFY_API_KEY: process.env.CLOCKIFY_API_KEY || "handshake-placeholder",
  },
  stdio: ["pipe", "pipe", "pipe"],
});

let stdout = "";
let stderr = "";
child.stdout.setEncoding("utf8");
child.stderr.setEncoding("utf8");
child.stdout.on("data", (chunk: string) => {
  stdout += chunk;
});
child.stderr.on("data", (chunk: string) => {
  stderr += chunk;
});

const request = {
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "handshake", version: "0.0.1" },
  },
};

child.stdin.write(`${JSON.stringify(request)}\n`);

const timeout = setTimeout(() => {
  child.kill("SIGTERM");
  console.error("FAIL: timed out waiting for initialize response");
  if (stderr) console.error(stderr);
  process.exit(1);
}, 5000);

child.on("error", (error) => {
  clearTimeout(timeout);
  console.error("FAIL:", error);
  process.exit(1);
});

const check = setInterval(() => {
  const lines = stdout.split("\n").filter(Boolean);
  for (const line of lines) {
    try {
      const msg = JSON.parse(line) as {
        id?: number;
        result?: { serverInfo?: { name?: string } };
        error?: unknown;
      };
      if (msg.id !== 1) continue;
      clearInterval(check);
      clearTimeout(timeout);
      child.kill("SIGTERM");
      if (msg.error) {
        console.error("FAIL:", msg.error);
        process.exit(1);
      }
      const name = msg.result?.serverInfo?.name;
      if (name !== "Clockify") {
        console.error("FAIL: unexpected serverInfo", msg.result);
        process.exit(1);
      }
      console.log(`OK: initialize handshake with ${name}`);
      process.exit(0);
    } catch {
      // wait for a full JSON line
    }
  }
}, 50);
