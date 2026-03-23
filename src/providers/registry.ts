import type { AIProvider } from "./base.js";
import type { ProviderConfig } from "../types.js";
import { ClaudeCliProvider, ClaudeApiProvider } from "./claude.js";
import { CodexCliProvider, CodexApiProvider } from "./codex.js";

type ProviderFactory = (config?: Partial<ProviderConfig>) => AIProvider;

const registry = new Map<string, { cli: ProviderFactory; api: ProviderFactory }>();

registry.set("claude", {
  cli: (cfg) => new ClaudeCliProvider(cfg),
  api: (cfg) => new ClaudeApiProvider(cfg),
});

registry.set("codex", {
  cli: (cfg) => new CodexCliProvider(cfg),
  api: (cfg) => new CodexApiProvider(cfg),
});

export function getProvider(
  name: string,
  config?: Partial<ProviderConfig>,
): AIProvider {
  const entry = registry.get(name);
  if (!entry) {
    throw new Error(
      `Unknown provider "${name}". Available: ${[...registry.keys()].join(", ")}`,
    );
  }

  const mode = config?.mode ?? "cli";
  const factory = mode === "api" ? entry.api : entry.cli;
  return factory(config);
}

export function listProviders(): string[] {
  return [...registry.keys()];
}

export function registerProvider(
  name: string,
  factories: { cli: ProviderFactory; api: ProviderFactory },
): void {
  registry.set(name, factories);
}
