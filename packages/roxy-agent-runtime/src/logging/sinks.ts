import { appendFileSync } from "node:fs";
import type { LogLevel } from "../core/interfaces.ts";

export interface ILogSink {
  write(level: LogLevel, scope: string, msg: string, meta: Record<string, unknown>): void;
}

export function createConsoleSink(): ILogSink {
  return {
    write(level, scope, msg, meta) {
      const prefix = `[${level.toUpperCase().padEnd(5)}] ${scope}:`;
      const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : "";
      // Use the appropriate console method for native terminal colouring.
      const fn = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
      fn(`${prefix} ${msg}${metaStr}`);
    },
  };
}

export function createFileSink(path: string): ILogSink {
  return {
    write(level, scope, msg, meta) {
      const line = JSON.stringify({ ts: Date.now(), level, scope, msg, ...meta }) + "\n";
      appendFileSync(path, line, "utf-8");
    },
  };
}
