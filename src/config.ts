import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import type { Config } from "./types.js";

const DEFAULTS: Config = {
  providers: ["claude", "codex"],
  maxRounds: 3,
  convergenceThreshold: 0.85,
  timeoutMs: 120_000,
  providerConfig: {
    claude: {
      command: "claude",
      args: ["-p", "{{prompt}}", "--output-format", "text"],
    },
    codex: {
      command: "codex",
      args: ["exec", "{{prompt}}"],
    },
  },
};

export function loadConfig(configPath?: string): Config {
  const paths = configPath
    ? [configPath]
    : [
        resolve(process.cwd(), ".mmw.config.json"),
        resolve(process.cwd(), "mmw.config.json"),
      ];

  for (const p of paths) {
    if (existsSync(p)) {
      try {
        const raw = readFileSync(p, "utf-8");
        const file = JSON.parse(raw) as Partial<Config>;
        return {
          ...DEFAULTS,
          ...file,
          providerConfig: {
            ...DEFAULTS.providerConfig,
            ...file.providerConfig,
          },
        };
      } catch (err) {
        console.warn(`Warning: failed to parse config at ${p}: ${err}`);
      }
    }
  }

  return DEFAULTS;
}
