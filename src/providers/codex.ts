import { AIProvider } from "./base.js";
import { extractPlan } from "../plan.js";
import type { Plan, ProviderConfig } from "../types.js";

const CLI_DEFAULTS: ProviderConfig = {
  mode: "cli",
  command: "codex",
  args: ["exec", "{{prompt}}"],
};

const API_DEFAULTS: ProviderConfig = {
  mode: "api",
  model: "gpt-4o",
  baseUrl: "https://api.openai.com",
};

export class CodexCliProvider extends AIProvider {
  constructor(config?: Partial<ProviderConfig>) {
    super("codex", { ...CLI_DEFAULTS, ...config, mode: "cli" });
  }

  async generatePlan(prompt: string): Promise<{ plan: Plan; raw: string }> {
    const raw = await this.spawn(prompt, 120_000);
    const plan = extractPlan(raw);
    return { plan, raw };
  }
}

export class CodexApiProvider extends AIProvider {
  constructor(config?: Partial<ProviderConfig>) {
    super("codex", { ...API_DEFAULTS, ...config, mode: "api" });
  }

  async generatePlan(prompt: string): Promise<{ plan: Plan; raw: string }> {
    const apiKey =
      this.config.apiKey || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error(
        "codex API mode requires OPENAI_API_KEY env var or apiKey in config",
      );
    }

    const baseUrl = this.config.baseUrl || API_DEFAULTS.baseUrl!;
    const model = this.config.model || API_DEFAULTS.model!;

    const response = await fetch(
      `${baseUrl}/v1/chat/completions`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          max_tokens: 4096,
          messages: [{ role: "user", content: prompt }],
        }),
      },
    );

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `OpenAI API error ${response.status}: ${body.slice(0, 500)}`,
      );
    }

    const data = (await response.json()) as {
      choices: Array<{ message: { content: string } }>;
    };

    const raw = data.choices[0]?.message?.content ?? "";
    const plan = extractPlan(raw);
    return { plan, raw };
  }
}
