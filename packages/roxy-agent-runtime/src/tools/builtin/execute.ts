import { spawn } from "node:child_process";
import type { BuiltinTool } from "./index.ts";
import type { CommandPermissions } from "./command_permissions.ts";

const MAX_OUTPUT = 4096;
const DEFAULT_TIMEOUT_MS = 30_000;

export interface ExecuteToolDeps {
  /**
   * Command-level policy. `deny` matches are hard-blocked here (every HITL
   * mode); `allow` matches are honored upstream by the HITL handlers.
   */
  commandPermissions?: CommandPermissions;
}

/** Execute a shell command with timeout and output truncation. Sensitive — requires HITL approval. */
export function executeTool(deps: ExecuteToolDeps = {}): BuiltinTool {
  return {
    descriptor: {
      name: "execute",
      description:
        "Execute a shell command. stdout and stderr are captured (truncated at 4096 chars total). Sensitive.",
      inputSchema: {
        type: "object",
        properties: {
          command: { type: "string", description: "Shell command to execute." },
          cwd: { type: "string", description: "Working directory (optional)." },
          timeoutMs: { type: "number", description: "Timeout in milliseconds (default 30000)." },
        },
        required: ["command"],
      },
      source: "builtin",
      metadata: { sensitive: true },
    },
    handler: async (input, _ctx) => {
      const raw = input as Record<string, unknown>;
      if (typeof raw?.command !== "string" || raw.command.length === 0) {
        return { content: "execute: 'command' is required", isError: true };
      }
      const command = raw.command;
      if (deps.commandPermissions?.evaluate(command) === "deny") {
        return {
          content: `execute: command denied by permissions policy: ${command}`,
          isError: true,
        };
      }
      const cwd = typeof raw.cwd === "string" ? raw.cwd : undefined;
      const timeoutMs = typeof raw.timeoutMs === "number" && raw.timeoutMs > 0 ? raw.timeoutMs : DEFAULT_TIMEOUT_MS;

      return new Promise((resolve) => {
        const child = spawn(command, { shell: true, cwd });
        const stdoutChunks: Buffer[] = [];
        const stderrChunks: Buffer[] = [];
        let timedOut = false;

        const timer = setTimeout(() => {
          timedOut = true;
          child.kill("SIGKILL");
        }, timeoutMs);

        child.stdout.on("data", (chunk: Buffer) => stdoutChunks.push(chunk));
        child.stderr.on("data", (chunk: Buffer) => stderrChunks.push(chunk));

        child.on("close", (code) => {
          clearTimeout(timer);
          if (timedOut) {
            resolve({
              content: `execute: timeout after ${timeoutMs}ms`,
              isError: true,
            });
            return;
          }
          let stdout = Buffer.concat(stdoutChunks).toString("utf8");
          let stderr = Buffer.concat(stderrChunks).toString("utf8");
          // Truncate combined output to MAX_OUTPUT
          if (stdout.length + stderr.length > MAX_OUTPUT) {
            const half = Math.floor(MAX_OUTPUT / 2);
            if (stdout.length > half) stdout = stdout.slice(0, half) + "…[truncated]";
            if (stderr.length > MAX_OUTPUT - stdout.length)
              stderr = stderr.slice(0, MAX_OUTPUT - stdout.length) + "…[truncated]";
          }
          const exitCode = code ?? 1;
          const status =
            exitCode === 0 ? `Command succeeded with exit code 0.` : `Command failed with exit code ${exitCode}.`;
          const content = `${status}\n\nexit_code: ${exitCode}\n\nstdout:\n${stdout}\nstderr:\n${stderr}`;
          resolve({ content, isError: exitCode !== 0 });
        });

        child.on("error", (err) => {
          clearTimeout(timer);
          resolve({ content: err.message, isError: true });
        });
      });
    },
  };
}
