/**
 * Failure mode: teams "have evals" until a prompt change ships untested. Design: goldens
 * as JSONL, Zod at the boundary, schema mode by default. RUN_LIVE is opt-in and not every
 * pipeline has a suite — this harness covers the core loop, not fundraising or enrich.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const Golden = z.object({
  id: z.string().min(1),
  query: z.string().min(1),
  expectCitedId: z.string().min(1),
  comment: z.string().min(1),
});

type Golden = z.infer<typeof Golden>;

const INDEX: Record<string, string> = {
  "last meeting with Avery": "new-11",
  "what's going on with the MBA partnership": "northwind-brief",
  "Q3 pricing review decisions": "pricing-q3",
};

function loadGoldenJsonl(path: string): Golden[] {
  return readFileSync(path, "utf8")
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line, i) => {
      const parsed = Golden.safeParse(JSON.parse(line));
      if (!parsed.success) throw new Error(`invalid golden at line ${i + 1}`);
      return parsed.data;
    });
}

function schemaRetrieve(query: string): string | null {
  return INDEX[query] ?? null;
}

const live = process.env.RUN_LIVE === "1";
const file = join(dirname(fileURLToPath(import.meta.url)), "goldens", "core.jsonl");
const goldens = loadGoldenJsonl(file);

let passed = 0;
for (const g of goldens) {
  // Live would call the model; schema mode (default) checks goldens against the index.
  const cited = schemaRetrieve(g.query);
  const ok = cited === g.expectCitedId;
  if (ok) passed += 1;
  console.log(`${ok ? "PASS" : "FAIL"} ${g.id}  ${g.comment}`);
}
console.log(`${passed}/${goldens.length} passed  mode=${live ? "live" : "schema"}`);
if (live) console.log("note: live would call the model; this reconstruction stubs the same index.");
if (passed !== goldens.length) process.exit(1);
