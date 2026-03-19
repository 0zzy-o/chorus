import type { AIProvider } from "./base.js";
import type { ProviderConfig } from "../types.js";
import { ClaudeProvider } from "./claude.js";
import { CodexProvider } from "./codex.js";

type ProviderFactory = (config?: Partial<ProviderConfig>) => AIProvider;

const registry = new Map<string, ProviderFactory>();

registry.set("claude", (cfg) => new ClaudeProvider(cfg));
registry.set("codex", (cfg) => new CodexProvider(cfg));

export function getProvider(
  name: string,
  config?: Partial<ProviderConfig>,
): AIProvider {
  const factory = registry.get(name);
  if (!factory) {
    throw new Error(
      `Unknown provider "${name}". Available: ${[...registry.keys()].join(", ")}`,
    );
  }
  return factory(config);
}

export function listProviders(): string[] {
  return [...registry.keys()];
}

export function registerProvider(
  name: string,
  factory: ProviderFactory,
): void {
  registry.set(name, factory);
}
