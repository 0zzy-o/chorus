import { AIProvider } from "./base.js";
import { extractPlan } from "../plan.js";
import type { Plan, ProviderConfig } from "../types.js";

const CLI_DEFAULTS: ProviderConfig = {
  mode: "cli",
  command: "claude",
  args: ["-p", "{{prompt}}", "--output-format", "text"],
};

const API_DEFAULTS: ProviderConfig = {
  mode: "api",
  model: "claude-sonnet-4-6",
  baseUrl: "https://api.anthropic.com",
};

export class ClaudeCliProvider extends AIProvider {
  constructor(config?: Partial<ProviderConfig>) {
    super("claude", { ...CLI_DEFAULTS, ...config, mode: "cli" });
  }

  async generatePlan(prompt: string): Promise<{ plan: Plan; raw: string }> {
    const raw = await this.spawn(prompt, 120_000);
    const plan = extractPlan(raw);
    return { plan, raw };
  }
}

export class ClaudeApiProvider extends AIProvider {
  constructor(config?: Partial<ProviderConfig>) {
    super("claude", { ...API_DEFAULTS, ...config, mode: "api" });
  }

  async generatePlan(prompt: string): Promise<{ plan: Plan; raw: string }> {
    const apiKey =
      this.config.apiKey || process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error(
        "claude API mode requires ANTHROPIC_API_KEY env var or apiKey in config",
      );
    }

    const baseUrl = this.config.baseUrl || API_DEFAULTS.baseUrl!;
    const model = this.config.model || API_DEFAULTS.model!;

    const response = await fetch(`${baseUrl}/v1/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `Claude API error ${response.status}: ${body.slice(0, 500)}`,
      );
    }

    const data = (await response.json()) as {
      content: Array<{ type: string; text: string }>;
    };

    const raw = data.content
      .filter((c) => c.type === "text")
      .map((c) => c.text)
      .join("\n");

    const plan = extractPlan(raw);
    return { plan, raw };
  }
}
