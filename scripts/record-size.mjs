#!/usr/bin/env node
// Walks Vite's build manifest to get the REAL transitive gzip cost per
// primitive (entry file + every shared chunk it pulls in), not just the
// size of the entry file's own re-export shim. Appends each run to
// size-history.jsonl so the extraction's bundle-size claims stay honest
// and comparable commit-to-commit.
import { execSync } from "node:child_process";
import { existsSync, readFileSync, appendFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const distDir = path.join(root, "dist");
const manifestPath = path.join(distDir, "manifest.json");

// name -> gzip byte budget. Failing a budget exits non-zero (CI-friendly).
const BUDGETS_KB = {
  button: 1,
  card: 1,
  popover: 3,
  select: 1,
  "empty-state": 1,
  "status-badge": 1,
  sheet: 3,
  "primitives-index": 8, // all primitives together, deduped
  "game-board": 15, // the whole interactive board, deduped, excludes react/react-router/lucide (external)
  "game-index": 15, // full game module barrel
};

if (!existsSync(manifestPath)) {
  console.error("dist/manifest.json missing — run `pnpm build` first.");
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

function gzipBytes(file) {
  const filePath = path.join(distDir, file);
  if (!existsSync(filePath)) return 0;
  return gzipSync(readFileSync(filePath), { level: 9 }).byteLength;
}

/** Entry file + every chunk it transitively imports, deduped, real gzip cost. */
function transitiveGzip(entryKey) {
  const seen = new Set();
  const stack = [entryKey];
  while (stack.length) {
    const key = stack.pop();
    if (seen.has(key)) continue;
    seen.add(key);
    for (const dep of manifest[key]?.imports ?? []) stack.push(dep);
  }
  let total = 0;
  for (const key of seen) total += gzipBytes(manifest[key].file);
  return total;
}

function gitHash() {
  try {
    return execSync("git rev-parse --short HEAD", { cwd: root }).toString().trim();
  } catch {
    return "uncommitted";
  }
}

const entryKeys = Object.keys(manifest).filter((k) => manifest[k].isEntry);
const results = entryKeys.map((key) => {
  const name = manifest[key].name;
  const gzip = transitiveGzip(key);
  const budgetBytes = (BUDGETS_KB[name] ?? Infinity) * 1024;
  return { name, gzipBytes: gzip, budgetBytes, pass: gzip <= budgetBytes };
});
results.sort((a, b) => a.name.localeCompare(b.name));

const record = {
  timestamp: new Date().toISOString(),
  gitHash: gitHash(),
  results: results.map(({ name, gzipBytes }) => ({ name, gzipBytes })),
};
appendFileSync(path.join(root, "size-history.jsonl"), JSON.stringify(record) + "\n");

const nameWidth = Math.max(...results.map((r) => r.name.length), 4);
console.log(`\n${"name".padEnd(nameWidth)}  gzip (real, transitive)   budget   status`);
let anyFail = false;
for (const r of results) {
  const status = r.pass ? "ok" : "OVER BUDGET";
  if (!r.pass) anyFail = true;
  console.log(
    `${r.name.padEnd(nameWidth)}  ${String(r.gzipBytes).padStart(6)} B                ` +
      `${Number.isFinite(r.budgetBytes) ? String(r.budgetBytes) + " B" : "—"}     ${status}`,
  );
}
console.log(`\nrecorded at ${record.timestamp} (${record.gitHash}) -> size-history.jsonl\n`);

if (anyFail) process.exit(1);
