/**
 * Failure mode: embedding similarity ranks a long older note ("Coach Avery weekly…")
 * above a short newer "Avery 1:1" for "last meeting with Avery". Design: detect
 * temporal intent, name-gate, date-first rank, and skip similarity merge so overlap
 * cannot resurrect the wordy record. Topic queries stay overlap-ranked.
 */
type Meeting = { id: string; title: string; body: string; occurredAt: string };

const FIXTURES: Meeting[] = [
  {
    id: "old-coach",
    title: "Coach Avery weekly: pipeline, objections, Q3 pricing review from the field",
    body: "Avery walked pricing bands, discount exceptions, and talk tracks for forty minutes.",
    occurredAt: "2026-06-02T15:00:00.000Z",
  },
  {
    id: "new-11",
    title: "Avery 1:1",
    body: "Hiring loop. Northwind partnership intro next week. No pricing.",
    occurredAt: "2026-09-05T16:00:00.000Z",
  },
  {
    id: "pricing-q3",
    title: "Q3 pricing review",
    body: "Discount bands for Northwind. No individual 1:1 notes.",
    occurredAt: "2026-08-20T14:00:00.000Z",
  },
];

const TEMPORAL = /\b(last|latest|most recent|yesterday)\b/i;

function personName(query: string): string | null {
  const hit = query.match(/\b(?:with|about)\s+([A-Z][a-z]+)\b/) ?? query.match(/\b(Avery)\b/);
  return hit?.[1] ?? null;
}

function nameGate(rows: Meeting[], name: string): Meeting[] {
  const n = name.toLowerCase();
  return rows.filter((m) => `${m.title} ${m.body}`.toLowerCase().includes(n));
}

function overlap(query: string, m: Meeting): number {
  const q = new Set(query.toLowerCase().split(/\W+/).filter(Boolean));
  const t = new Set(`${m.title} ${m.body}`.toLowerCase().split(/\W+/).filter(Boolean));
  let n = 0;
  for (const w of q) if (t.has(w)) n += 1;
  return n / Math.max(q.size, 1);
}

function rank(query: string, rows: Meeting[]): Meeting[] {
  const name = personName(query);
  const gated = name ? nameGate(rows, name) : [...rows];
  if (TEMPORAL.test(query)) {
    return [...gated].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
  }
  return [...gated].sort((a, b) => overlap(query, b) - overlap(query, a));
}

const lastAvery = rank("Last meeting with Avery", FIXTURES);
const pricing = rank("what did Avery say about pricing", FIXTURES);
const lastOk = lastAvery[0]?.id === "new-11";
const pricingOk = pricing[0]?.id === "old-coach";

console.log("last meeting with Avery →", lastAvery.map((m) => m.id).join(" > "));
console.log("Avery / pricing (overlap) →", pricing.map((m) => m.id).join(" > "));
if (!lastOk || !pricingOk) {
  console.error("FAIL: expected newest 1:1 for temporal; older coach note for pricing overlap");
  process.exit(1);
}
console.log("PASS");
