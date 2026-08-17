#!/usr/bin/env node
/**
 * Assert package, plugin, and lockfile versions match.
 * When RELEASE_TAG is set (GitHub Release publish), also require tag vX.Y.Z.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function readJson(rel) {
  return JSON.parse(readFileSync(join(root, rel), "utf8"));
}

const packageVersion = readJson("package.json").version;
const pluginVersion = readJson("plugin.json").version;
const cursorPluginVersion = readJson(".cursor-plugin/plugin.json").version;
const lock = readJson("package-lock.json");
const lockRoot = lock.version;
const lockPkg = lock.packages?.[""]?.version;

const found = [
  ["plugin.json", pluginVersion],
  [".cursor-plugin/plugin.json", cursorPluginVersion],
  ["package-lock.json", lockRoot],
  ['package-lock.json packages[""]', lockPkg],
];

const mismatches = found.filter(([, version]) => version !== packageVersion);
if (mismatches.length) {
  const detail = mismatches
    .map(([name, version]) => `${name}=${version}`)
    .join(", ");
  console.error(
    `Version mismatch: package.json is ${packageVersion}; also found ${detail}`,
  );
  process.exit(1);
}

const tag = process.env.RELEASE_TAG;
if (tag) {
  const expected = `v${packageVersion}`;
  if (tag !== expected) {
    console.error(
      `Release tag ${tag} does not match package.json version ${expected}`,
    );
    process.exit(1);
  }
}

console.log(
  tag
    ? `versions ok: ${packageVersion} (tag ${tag})`
    : `versions ok: ${packageVersion}`,
);
