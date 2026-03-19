import { AIProvider } from "./base.js";
import { extractPlan } from "../plan.js";
import type { Plan, ProviderConfig } from "../types.js";

const DEFAULT_CONFIG: ProviderConfig = {
  command: "codex",
  args: ["exec", "{{prompt}}"],
};

export class CodexProvider extends AIProvider {
  constructor(config?: Partial<ProviderConfig>) {
    super("codex", { ...DEFAULT_CONFIG, ...config });
  }

  async generatePlan(prompt: string): Promise<{ plan: Plan; raw: string }> {
    const raw = await this.spawn(prompt, 120_000);
    const plan = extractPlan(raw);
    return { plan, raw };
  }
}
