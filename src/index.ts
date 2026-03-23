#!/usr/bin/env node

import { Command } from "commander";
import chalk from "chalk";
import { loadConfig } from "./config.js";
import { getProvider, listProviders } from "./providers/registry.js";
import { runDebate } from "./orchestrator.js";
import { printFinalPlan, promptApproval } from "./ui.js";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execSync } from "node:child_process";
import type { Plan } from "./types.js";

const program = new Command();

program
  .name("chorus")
  .description(
    "Chorus — coordinate multiple AI models through iterative debate",
  )
  .version("0.1.0")
  .argument("<task>", "Task description for the AI models to plan")
  .option("-r, --rounds <n>", "Maximum debate rounds", "3")
  .option(
    "-p, --providers <list>",
    "Comma-separated provider names",
    "claude,codex",
  )
  .option(
    "-m, --mode <mode>",
    'Provider mode: "cli" or "api" (applies to all providers unless overridden in config)',
  )
  .option("-e, --execute", "Execute the plan after approval")
  .option("-v, --verbose", "Show raw model output")
  .option("-c, --config <path>", "Path to config file")
  .option(
    "-t, --threshold <n>",
    "Convergence threshold (0-1)",
    "0.85",
  )
  .action(async (task: string, opts) => {
    const config = loadConfig(opts.config);

    // Apply CLI overrides
    if (opts.rounds) config.maxRounds = parseInt(opts.rounds, 10);
    if (opts.threshold)
      config.convergenceThreshold = parseFloat(opts.threshold);
    if (opts.providers) config.providers = opts.providers.split(",");

    // Apply mode override to all providers that don't have an explicit mode in config
    if (opts.mode) {
      const mode = opts.mode as "cli" | "api";
      for (const name of config.providers) {
        if (!config.providerConfig[name]) {
          config.providerConfig[name] = { mode };
        } else {
          config.providerConfig[name] = {
            ...config.providerConfig[name],
            mode,
          };
        }
      }
    }

    const modeLabel = opts.mode ?? "per-config";

    console.log(chalk.bold.cyan("\n🎵 Chorus\n"));
    console.log(chalk.dim(`Task: ${task}`));
    console.log(
      chalk.dim(
        `Providers: ${config.providers.join(", ")} | Mode: ${modeLabel} | Max rounds: ${config.maxRounds} | Threshold: ${config.convergenceThreshold}`,
      ),
    );

    // Validate providers
    const available = listProviders();
    for (const name of config.providers) {
      if (!available.includes(name)) {
        console.error(
          chalk.red(
            `Unknown provider "${name}". Available: ${available.join(", ")}`,
          ),
        );
        process.exit(1);
      }
    }

    // Instantiate providers
    const providers = config.providers.map((name) =>
      getProvider(name, config.providerConfig[name]),
    );

    try {
      const result = await runDebate(task, providers, config, !!opts.verbose);

      printFinalPlan(result.finalPlan);

      const approval = await promptApproval();

      if (approval === "edit") {
        const edited = await editPlanInEditor(result.finalPlan);
        if (edited) {
          printFinalPlan(edited);
          const approval2 = await promptApproval();
          if (approval2 === "approve" && opts.execute) {
            await executePlan(edited, providers[0]);
          } else if (approval2 !== "approve") {
            console.log(chalk.yellow("Plan rejected."));
          }
        }
      } else if (approval === "approve") {
        if (opts.execute) {
          await executePlan(result.finalPlan, providers[0]);
        } else {
          console.log(
            chalk.green(
              "\nPlan approved. Run with --execute to execute it.",
            ),
          );
        }
      } else {
        console.log(chalk.yellow("Plan rejected."));
      }
    } catch (err) {
      console.error(chalk.red(`\nError: ${(err as Error).message}`));
      process.exit(1);
    }
  });

async function editPlanInEditor(plan: Plan): Promise<Plan | null> {
  const tmpFile = join(tmpdir(), `chorus-plan-${Date.now()}.json`);
  writeFileSync(tmpFile, JSON.stringify(plan, null, 2));

  const editor = process.env.EDITOR || "vi";
  try {
    execSync(`${editor} ${tmpFile}`, { stdio: "inherit" });
    const { readFileSync } = await import("node:fs");
    const edited = JSON.parse(readFileSync(tmpFile, "utf-8")) as Plan;
    return edited;
  } catch {
    console.error(chalk.red("Failed to edit plan"));
    return null;
  }
}

async function executePlan(
  plan: Plan,
  provider: { name: string; generatePlan: (p: string) => Promise<unknown> },
): Promise<void> {
  console.log(
    chalk.bold.cyan(`\nExecuting plan via ${provider.name}...\n`),
  );

  const executionPrompt = `Execute the following implementation plan step by step:

${JSON.stringify(plan, null, 2)}

Implement each step in order. Create/modify the necessary files.`;

  try {
    await provider.generatePlan(executionPrompt);
    console.log(chalk.green("\nExecution complete."));
  } catch (err) {
    console.error(
      chalk.red(`\nExecution failed: ${(err as Error).message}`),
    );
  }
}

program.parse();
