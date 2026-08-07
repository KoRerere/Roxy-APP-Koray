import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { join } from "node:path";
import { readdir, writeFile } from "node:fs/promises";
import type { ToolContext } from "../../../src/core/interfaces.ts";
import { CommandPermissions } from "../../../src/tools/builtin/command_permissions.ts";
import { executeTool } from "../../../src/tools/builtin/execute.ts";
import { DelegateHitlHandler, StrictHitlHandler } from "../../../src/hitl/handler.ts";
import { makeTempDir } from "../../helpers/tempDir.ts";

const ctx: ToolContext = {
  agentId: "test-agent",
  traceId: "test-trace",
  signal: new AbortController().signal,
};

describe("CommandPermissions.evaluate", () => {
  it("returns 'allow' for a command matching an allow pattern", () => {
    const p = new CommandPermissions({ allow: ["git status*", "npm test*"] });
    expect(p.evaluate("git status")).toBe("allow");
    expect(p.evaluate("git status --short")).toBe("allow");
    expect(p.evaluate("npm test")).toBe("allow");
  });

  it("returns 'ask' for a command matching nothing", () => {
    const p = new CommandPermissions({ allow: ["git status*"] });
    expect(p.evaluate("git push")).toBe("ask");
    expect(p.evaluate("ls")).toBe("ask");
  });

  it("returns 'deny' for a command matching a deny pattern", () => {
    const p = new CommandPermissions({ deny: ["rm *", "sudo *"] });
    expect(p.evaluate("rm -rf /tmp/x")).toBe("deny");
    expect(p.evaluate("sudo reboot")).toBe("deny");
  });

  it("deny wins over allow", () => {
    const p = new CommandPermissions({ allow: ["git *"], deny: ["git push*"] });
    expect(p.evaluate("git push origin main")).toBe("deny");
    expect(p.evaluate("git status")).toBe("allow");
  });

  it("compound commands never auto-allow (shell operators force 'ask')", () => {
    const p = new CommandPermissions({ allow: ["git status*", "echo *"] });
    // An allow prefix must not smuggle a second command past the gate.
    expect(p.evaluate("git status && rm -rf /")).toBe("ask");
    expect(p.evaluate("git status; rm -rf /")).toBe("ask");
    expect(p.evaluate("git status | sh")).toBe("ask");
    expect(p.evaluate("echo $(rm -rf /)")).toBe("ask");
    expect(p.evaluate("echo `whoami`")).toBe("ask");
    expect(p.evaluate("echo hi > /etc/passwd")).toBe("ask");
    expect(p.evaluate("echo hi\nrm -rf /")).toBe("ask");
  });

  it("deny still applies to compound commands", () => {
    const p = new CommandPermissions({ deny: ["*rm -rf*"] });
    expect(p.evaluate("git status && rm -rf /")).toBe("deny");
  });

  it("trims surrounding whitespace before matching", () => {
    const p = new CommandPermissions({ allow: ["git status*"] });
    expect(p.evaluate("  git status  ")).toBe("allow");
  });
});

describe("execute tool with command permissions", () => {
  let tmpPath: string;
  let cleanup: () => Promise<void>;

  beforeEach(async () => {
    ({ path: tmpPath, cleanup } = await makeTempDir());
  });
  afterEach(() => cleanup());

  it("hard-blocks a denied command without running it", async () => {
    const permissions = new CommandPermissions({ deny: ["touch *"] });
    const { handler } = executeTool({ commandPermissions: permissions });

    const result = await handler({ command: `touch ${join(tmpPath, "evil.txt")}`, cwd: tmpPath }, ctx);

    expect(result.isError).toBe(true);
    expect(result.content).toContain("denied");
    // The command must NOT have executed.
    expect(await readdir(tmpPath)).toEqual([]);
  });

  it("runs allowed and unmatched commands normally", async () => {
    const permissions = new CommandPermissions({ allow: ["echo *"], deny: ["rm *"] });
    const { handler } = executeTool({ commandPermissions: permissions });

    const allowed = await handler({ command: "echo hello" }, ctx);
    expect(allowed.isError).toBe(false);
    expect(allowed.content).toContain("hello");

    // Unmatched ("ask") commands are not blocked at the tool layer — the
    // HITL gate upstream owns the approval; the tool only enforces deny.
    const unmatched = await handler({ command: "pwd" }, ctx);
    expect(unmatched.isError).toBe(false);
  });

  it("without permissions the tool behaves as before", async () => {
    const file = join(tmpPath, "ok.txt");
    await writeFile(file, "x");
    const { handler } = executeTool();
    const result = await handler({ command: "ls", cwd: tmpPath }, ctx);
    expect(result.isError).toBe(false);
    expect(result.content).toContain("ok.txt");
  });
});

describe("HITL handlers with command permissions", () => {
  const executeDescriptor = {
    name: "execute",
    description: "run",
    inputSchema: {},
    source: "builtin" as const,
    metadata: { sensitive: true },
  };

  it("delegate mode: allow-listed command skips approval", () => {
    const permissions = new CommandPermissions({ allow: ["git status*"] });
    const hitl = new DelegateHitlHandler([], { commandPermissions: permissions });

    expect(hitl.needsApproval(executeDescriptor, { command: "git status" })).toBe(false);
    // Unmatched commands still hit the sensitive-metadata gate.
    expect(hitl.needsApproval(executeDescriptor, { command: "git push" })).toBe(true);
  });

  it("delegate mode: denied command skips approval (tool hard-blocks it)", () => {
    const permissions = new CommandPermissions({ deny: ["rm *"] });
    const hitl = new DelegateHitlHandler([], { commandPermissions: permissions });
    // No point asking a human about a command that policy already refuses.
    expect(hitl.needsApproval(executeDescriptor, { command: "rm -rf /" })).toBe(false);
  });

  it("strict mode: an explicit allow pattern bypasses even strict approval", () => {
    const permissions = new CommandPermissions({ allow: ["git status*"] });
    const hitl = new StrictHitlHandler(false, { commandPermissions: permissions });

    expect(hitl.needsApproval(executeDescriptor, { command: "git status" })).toBe(false);
    expect(hitl.needsApproval(executeDescriptor, { command: "git push" })).toBe(true);
  });

  it("compound command riding an allow pattern still needs approval", () => {
    const permissions = new CommandPermissions({ allow: ["git status*"] });
    const hitl = new DelegateHitlHandler([], { commandPermissions: permissions });
    expect(hitl.needsApproval(executeDescriptor, { command: "git status && rm -rf /" })).toBe(true);
  });

  it("non-execute tools are unaffected by command permissions", () => {
    const permissions = new CommandPermissions({ allow: ["*"] });
    const hitl = new DelegateHitlHandler([], { commandPermissions: permissions });
    const writeDescriptor = { ...executeDescriptor, name: "write_file" };
    expect(hitl.needsApproval(writeDescriptor, { command: "anything" })).toBe(true);
  });
});
