import chalk from "chalk";
import ora, { type Ora } from "ora";
import Table from "cli-table3";
import type { Plan, DebateMessage } from "./types.js";
import { planSimilarity } from "./convergence.js";
import { createInterface } from "node:readline";

export function createSpinner(text: string): Ora {
  return ora({ text, spinner: "dots" });
}

export function printRoundHeader(round: number): void {
  console.log(
    "\n" + chalk.bold.cyan(`═══ Round ${round} ${"═".repeat(50)}`),
  );
}

export function printPlanComparison(messages: DebateMessage[]): void {
  if (messages.length === 0) return;

  const table = new Table({
    head: messages.map((m) => chalk.bold(m.provider)),
    colWidths: messages.map(() =>
      Math.max(40, Math.floor((process.stdout.columns || 100) / messages.length) - 4),
    ),
    wordWrap: true,
  });

  // Summary row
  table.push(
    messages.map((m) => chalk.yellow("Summary: ") + m.plan.summary),
  );

  // Steps
  const maxSteps = Math.max(...messages.map((m) => m.plan.steps.length));
  for (let i = 0; i < maxSteps; i++) {
    table.push(
      messages.map((m) => {
        const step = m.plan.steps[i];
        if (!step) return chalk.dim("—");
        return (
          chalk.green(`${step.id}. ${step.title}`) + "\n" + step.detail
        );
      }),
    );
  }

  // Risks
  const hasRisks = messages.some(
    (m) => m.plan.risks && m.plan.risks.length > 0,
  );
  if (hasRisks) {
    table.push(
      messages.map((m) => {
        if (!m.plan.risks || m.plan.risks.length === 0) return chalk.dim("—");
        return chalk.red("Risks:\n") + m.plan.risks.map((r) => `• ${r}`).join("\n");
      }),
    );
  }

  console.log(table.toString());

  // Print pairwise similarities
  if (messages.length >= 2) {
    for (let i = 0; i < messages.length; i++) {
      for (let j = i + 1; j < messages.length; j++) {
        const sim = planSimilarity(messages[i].plan, messages[j].plan);
        const color = sim >= 0.85 ? chalk.green : sim >= 0.5 ? chalk.yellow : chalk.red;
        console.log(
          `  Similarity (${messages[i].provider} ↔ ${messages[j].provider}): ${color((sim * 100).toFixed(1) + "%")}`,
        );
      }
    }
  }
}

export function printConvergence(converged: boolean, round: number): void {
  if (converged) {
    console.log(
      chalk.bold.green(`\n✓ Plans converged after ${round} round(s)`),
    );
  } else {
    console.log(
      chalk.bold.yellow(`\n⚠ Max rounds reached without full convergence`),
    );
  }
}

export function printFinalPlan(plan: Plan): void {
  console.log(chalk.bold.cyan("\n═══ Final Plan " + "═".repeat(48)));
  console.log(chalk.bold(plan.summary) + "\n");

  for (const step of plan.steps) {
    console.log(chalk.green(`  ${step.id}. ${step.title}`));
    console.log(`     ${step.detail}`);
    if (step.files && step.files.length > 0) {
      console.log(chalk.dim(`     Files: ${step.files.join(", ")}`));
    }
  }

  if (plan.risks && plan.risks.length > 0) {
    console.log(chalk.red("\n  Risks:"));
    for (const risk of plan.risks) {
      console.log(chalk.red(`    • ${risk}`));
    }
  }
}

export async function promptApproval(): Promise<"approve" | "reject" | "edit"> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(
      chalk.bold("\nApprove this plan? [y]es / [n]o / [e]dit: "),
      (answer) => {
        rl.close();
        const a = answer.trim().toLowerCase();
        if (a === "y" || a === "yes") resolve("approve");
        else if (a === "e" || a === "edit") resolve("edit");
        else resolve("reject");
      },
    );
  });
}

export function printVerbose(provider: string, raw: string): void {
  console.log(chalk.dim(`\n--- Raw output from ${provider} ---`));
  console.log(chalk.dim(raw.slice(0, 2000)));
  if (raw.length > 2000) console.log(chalk.dim("... (truncated)"));
  console.log(chalk.dim("--- end ---\n"));
}
