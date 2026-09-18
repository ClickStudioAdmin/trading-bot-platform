import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { LUCIDE_ICONS } from "../components/icons";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const ALLOWED_LUCIDE = join("components", "icons.tsx");

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (
      entry.name === "node_modules" ||
      entry.name === ".next" ||
      entry.name === ".git"
    ) {
      continue;
    }
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(path, out);
      continue;
    }
    if (/\.(ts|tsx|js|jsx|mjs)$/.test(entry.name)) {
      out.push(path);
    }
  }
  return out;
}

const names = LUCIDE_ICONS.map((row) => row.name);
assert.equal(new Set(names).size, names.length, "Lucide catalog names must be unique");

const lucideIds = LUCIDE_ICONS.map((row) => row.id);
assert.equal(new Set(lucideIds).size, lucideIds.length, "Lucide catalog ids must be unique");

const leaks: string[] = [];
for (const file of walk(ROOT)) {
  const rel = relative(ROOT, file).replaceAll("\\", "/");
  if (rel === ALLOWED_LUCIDE.replaceAll("\\", "/")) {
    continue;
  }
  const text = readFileSync(file, "utf8");
  if (
    /from\s+["']lucide-react["']/.test(text) ||
    /from\s+["']@heroicons\//.test(text) ||
    /from\s+["']react-icons/.test(text) ||
    /from\s+["']@tabler\/icons-react["']/.test(text) ||
    /from\s+["']phosphor-react["']/.test(text)
  ) {
    leaks.push(rel);
  }
}
assert.deepEqual(
  leaks,
  [],
  `Import icons from @/components/icons. Add Lucide icons there first.\n${leaks.join("\n")}`,
);

console.log("icons.check ok");
