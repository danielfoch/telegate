// Asserts the landing page's ONE_SHOT_PROMPT equals the fenced block in docs/ONE-SHOT-INSTALL.md.
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const tsPath = resolve(here, "../src/content/one-shot-prompt.ts");
const docPath = resolve(here, "../../docs/ONE-SHOT-INSTALL.md");

const ts = readFileSync(tsPath, "utf8");
const m = ts.match(/export const ONE_SHOT_PROMPT = (".*");/s);
if (!m) { console.error("ONE_SHOT_PROMPT not found"); process.exit(1); }
const fromTs = JSON.parse(m[1]).trim();

const doc = readFileSync(docPath, "utf8");
const fence = doc.match(/```text\n([\s\S]*?)\n```/);
if (!fence) { console.error("No ```text fence in docs/ONE-SHOT-INSTALL.md"); process.exit(1); }
const fromDoc = fence[1].trim();

if (fromTs !== fromDoc) {
  console.error("Prompt drift: src/content/one-shot-prompt.ts differs from docs/ONE-SHOT-INSTALL.md");
  const a = fromTs.split("\n"), b = fromDoc.split("\n");
  for (let i = 0; i < Math.max(a.length, b.length); i++) if (a[i] !== b[i]) { console.error(`first difference at line ${i + 1}:\n  ts : ${a[i]}\n  doc: ${b[i]}`); break; }
  process.exit(1);
}
console.log(`ok: prompt matches docs/ONE-SHOT-INSTALL.md (${fromTs.split("\n").length} lines)`);
