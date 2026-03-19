import type { Plan, PlanStep } from "./types.js";

export function extractPlan(raw: string): Plan {
  // Tier 1: direct JSON parse
  try {
    return validatePlan(JSON.parse(raw));
  } catch {
    // continue
  }

  // Tier 2: extract from ```json ``` fences
  const fenceMatch = raw.match(/```json\s*\n([\s\S]*?)```/);
  if (fenceMatch) {
    try {
      return validatePlan(JSON.parse(fenceMatch[1]));
    } catch {
      // continue
    }
  }

  // Also try generic ``` fences
  const genericFence = raw.match(/```\s*\n([\s\S]*?)```/);
  if (genericFence) {
    try {
      return validatePlan(JSON.parse(genericFence[1]));
    } catch {
      // continue
    }
  }

  // Tier 3: find first { to last }
  const firstBrace = raw.indexOf("{");
  const lastBrace = raw.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    try {
      return validatePlan(JSON.parse(raw.slice(firstBrace, lastBrace + 1)));
    } catch {
      // continue
    }
  }

  // Fallback: parse as free-form text into a single-step plan
  return {
    summary: raw.slice(0, 200).trim(),
    steps: [
      {
        id: "1",
        title: "Execute task",
        detail: raw.trim(),
      },
    ],
  };
}

function validatePlan(obj: unknown): Plan {
  if (typeof obj !== "object" || obj === null) {
    throw new Error("Plan is not an object");
  }

  const plan = obj as Record<string, unknown>;

  if (typeof plan.summary !== "string") {
    throw new Error("Plan missing summary");
  }

  if (!Array.isArray(plan.steps) || plan.steps.length === 0) {
    throw new Error("Plan missing steps");
  }

  const steps: PlanStep[] = plan.steps.map(
    (s: Record<string, unknown>, i: number) => ({
      id: String(s.id ?? i + 1),
      title: String(s.title ?? `Step ${i + 1}`),
      detail: String(s.detail ?? s.description ?? ""),
      files: Array.isArray(s.files) ? s.files.map(String) : undefined,
    }),
  );

  return {
    summary: plan.summary as string,
    steps,
    risks: Array.isArray(plan.risks) ? plan.risks.map(String) : undefined,
  };
}
