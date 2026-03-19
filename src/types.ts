export interface PlanStep {
  id: string;
  title: string;
  detail: string;
  files?: string[];
}

export interface Plan {
  summary: string;
  steps: PlanStep[];
  risks?: string[];
}

export interface DebateMessage {
  round: number;
  provider: string;
  plan: Plan;
  critique?: string;
  raw: string;
}

export interface DebateResult {
  rounds: DebateMessage[][];
  converged: boolean;
  finalPlan: Plan;
}

export interface ProviderConfig {
  command: string;
  args: string[];
}

export interface Config {
  providers: string[];
  maxRounds: number;
  convergenceThreshold: number;
  timeoutMs: number;
  providerConfig: Record<string, ProviderConfig>;
}
