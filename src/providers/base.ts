import { spawn } from "node:child_process";
import type { Plan, ProviderConfig } from "../types.js";

export abstract class AIProvider {
  constructor(
    public readonly name: string,
    protected config: ProviderConfig,
  ) {}

  abstract generatePlan(prompt: string): Promise<{ plan: Plan; raw: string }>;

  protected spawn(prompt: string, timeoutMs: number): Promise<string> {
    return new Promise((resolve, reject) => {
      const args = this.config.args.map((a) =>
        a.replace("{{prompt}}", prompt),
      );

      const proc = spawn(this.config.command, args, {
        stdio: ["ignore", "pipe", "pipe"],
        env: { ...process.env },
      });

      let stdout = "";
      let stderr = "";

      proc.stdout.on("data", (d: Buffer) => {
        stdout += d.toString();
      });
      proc.stderr.on("data", (d: Buffer) => {
        stderr += d.toString();
      });

      const timer = setTimeout(() => {
        proc.kill("SIGTERM");
        reject(new Error(`${this.name} timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      proc.on("close", (code) => {
        clearTimeout(timer);
        if (code !== 0) {
          reject(
            new Error(
              `${this.name} exited with code ${code}: ${stderr.slice(0, 500)}`,
            ),
          );
        } else {
          resolve(stdout);
        }
      });

      proc.on("error", (err) => {
        clearTimeout(timer);
        reject(
          new Error(`${this.name} failed to spawn: ${(err as Error).message}`),
        );
      });
    });
  }
}
