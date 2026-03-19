import type { AIProvider } from "./providers/base.js";
import type { Config, DebateMessage, DebateResult, Plan } from "./types.js";
import { hasConverged } from "./convergence.js";
import {
  createSpinner,
  printRoundHeader,
  printPlanComparison,
  printConvergence,
  printVerbose,
} from "./ui.js";

function buildInitialPrompt(task: string): string {
  return `You are a senior software architect. Analyze this task and produce a detailed implementation plan.

Task: ${task}

Respond with ONLY a JSON object in this exact format (no other text):
{
  "summary": "Brief description of the plan",
  "steps": [
    {
      "id": "1",
      "title": "Step title",
      "detail": "Detailed description of what to do",
      "files": ["file1.ts", "file2.ts"]
    }
  ],
  "risks": ["Risk 1", "Risk 2"]
}`;
}

function buildCritiquePrompt(
  task: string,
  otherProvider: string,
  otherPlan: Plan,
): string {
  return `You are a senior software architect reviewing a colleague's implementation plan.

Original task: ${task}

Plan from ${otherProvider}:
${JSON.stringify(otherPlan, null, 2)}

Review the above plan. Identify weaknesses, missing steps, or improvements.
Then produce your own IMPROVED plan that addresses those issues.

Respond with ONLY a JSON object in this exact format (no other text):
{
  "summary": "Brief description of your improved plan",
  "steps": [
    {
      "id": "1",
      "title": "Step title",
      "detail": "Detailed description of what to do",
      "files": ["file1.ts", "file2.ts"]
    }
  ],
  "risks": ["Risk 1", "Risk 2"]
}`;
}

export async function runDebate(
  task: string,
  providers: AIProvider[],
  config: Config,
  verbose: boolean,
): Promise<DebateResult> {
  const allRounds: DebateMessage[][] = [];
  let lastMessages: DebateMessage[] = [];

  for (let round = 1; round <= config.maxRounds; round++) {
    printRoundHeader(round);

    const roundMessages: DebateMessage[] = [];

    // Run all providers in parallel
    const spinner = createSpinner(
      `Round ${round}: ${providers.map((p) => p.name).join(", ")} generating plans...`,
    );
    spinner.start();

    const results = await Promise.allSettled(
      providers.map(async (provider) => {
        let prompt: string;

        if (round === 1) {
          prompt = buildInitialPrompt(task);
        } else {
          // Find the other provider's plan from the last round
          const otherMsg = lastMessages.find(
            (m) => m.provider !== provider.name,
          );
          if (otherMsg) {
            prompt = buildCritiquePrompt(task, otherMsg.provider, otherMsg.plan);
          } else {
            prompt = buildInitialPrompt(task);
          }
        }

        return provider.generatePlan(prompt);
      }),
    );

    spinner.stop();

    for (let i = 0; i < providers.length; i++) {
      const result = results[i];
      if (result.status === "fulfilled") {
        const msg: DebateMessage = {
          round,
          provider: providers[i].name,
          plan: result.value.plan,
          raw: result.value.raw,
        };
        roundMessages.push(msg);

        if (verbose) {
          printVerbose(providers[i].name, result.value.raw);
        }
      } else {
        console.error(
          `  ✗ ${providers[i].name} failed: ${result.reason}`,
        );
      }
    }

    if (roundMessages.length === 0) {
      throw new Error("All providers failed in round " + round);
    }

    printPlanComparison(roundMessages);

    allRounds.push(roundMessages);
    lastMessages = roundMessages;

    // Check convergence
    const plans = roundMessages.map((m) => m.plan);
    if (hasConverged(plans, config.convergenceThreshold)) {
      printConvergence(true, round);
      return {
        rounds: allRounds,
        converged: true,
        finalPlan: selectFinalPlan(roundMessages),
      };
    }
  }

  printConvergence(false, config.maxRounds);

  return {
    rounds: allRounds,
    converged: false,
    finalPlan: selectFinalPlan(lastMessages),
  };
}

function selectFinalPlan(messages: DebateMessage[]): Plan {
  // Select the plan with the most steps as the "richest" plan
  // In the future, this could merge plans intelligently
  let best = messages[0];
  for (const msg of messages) {
    if (msg.plan.steps.length > best.plan.steps.length) {
      best = msg;
    }
  }

  return best.plan;
}
