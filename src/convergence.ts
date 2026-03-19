import type { Plan } from "./types.js";

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .split(/\s+/)
      .filter((t) => t.length > 1),
  );
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;

  let intersection = 0;
  for (const token of a) {
    if (b.has(token)) intersection++;
  }

  const union = a.size + b.size - intersection;
  return union === 0 ? 1 : intersection / union;
}

export function planSimilarity(a: Plan, b: Plan): number {
  const aTitles = a.steps.map((s) => s.title);
  const bTitles = b.steps.map((s) => s.title);

  const aTokens = tokenize(aTitles.join(" "));
  const bTokens = tokenize(bTitles.join(" "));

  return jaccardSimilarity(aTokens, bTokens);
}

export function hasConverged(
  plans: Plan[],
  threshold: number,
): boolean {
  if (plans.length < 2) return true;

  let totalSimilarity = 0;
  let pairs = 0;

  for (let i = 0; i < plans.length; i++) {
    for (let j = i + 1; j < plans.length; j++) {
      totalSimilarity += planSimilarity(plans[i], plans[j]);
      pairs++;
    }
  }

  return pairs > 0 && totalSimilarity / pairs >= threshold;
}
