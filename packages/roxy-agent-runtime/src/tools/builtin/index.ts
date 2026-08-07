import type { IClarificationHandler, IHITLHandler, ToolDescriptor, ToolHandler } from "../../core/interfaces.ts";
import { todo_writeTool } from "./todo_write.ts";
import { ask_userTool } from "./ask_user.ts";
import { read_fileTool } from "./read_file.ts";
import { globTool } from "./glob.ts";
import { grepTool } from "./grep.ts";
import { lsTool } from "./ls.ts";
import { write_fileTool } from "./write_file.ts";
import { edit_fileTool } from "./edit_file.ts";
import { executeTool } from "./execute.ts";
import { web_fetchTool } from "./web_fetch.ts";
import type { PathPermissions } from "./permissions.ts";
import type { CommandPermissions } from "./command_permissions.ts";

export interface BuiltinTool {
  descriptor: ToolDescriptor;
  handler: ToolHandler;
}

export interface BuiltinToolDeps {
  enableTodos?: boolean;
  clarificationHandler?: IClarificationHandler;
  /** Path permission layer for the read tools (read_file/ls/glob/grep). */
  permissions?: PathPermissions;
  /** Command-level policy for `execute` (deny enforced in every HITL mode). */
  commandPermissions?: CommandPermissions;
  /** HITL handler for `ask` (outside-root) read approvals. */
  hitl?: IHITLHandler;
}

/**
 * Return all builtin tool entries, ready to register.
 *
 * Always includes the filesystem/shell family (`read_file`, `glob`, `grep`,
 * `ls`, `write_file`, `edit_file`, `execute`) — without these the agent cannot
 * fulfil progressive-disclosure skill instructions (e.g. "read guides/x.md")
 * or operate on files at all. The mutating/executing ones carry
 * `metadata.sensitive` so HITL gates them in strict/delegate modes. The read
 * tools additionally consult {@link PathPermissions} (deny in all modes, `ask`
 * → HITL in strict/delegate).
 *
 * `todo_write` and `ask_user` are only included when their deps are provided.
 */
export function registerBuiltinTools(deps: BuiltinToolDeps = {}): BuiltinTool[] {
  const readDeps = { permissions: deps.permissions, hitl: deps.hitl };
  const tools: BuiltinTool[] = [
    read_fileTool(readDeps),
    globTool(readDeps),
    grepTool(readDeps),
    lsTool(readDeps),
    write_fileTool(),
    edit_fileTool(),
    executeTool(deps.commandPermissions ? { commandPermissions: deps.commandPermissions } : {}),
    web_fetchTool(),
  ];
  if (deps.enableTodos) {
    tools.push(todo_writeTool());
  }
  if (deps.clarificationHandler) {
    tools.push(ask_userTool(deps.clarificationHandler));
  }
  return tools;
}
