import type { IClarificationHandler, IHITLHandler, ToolDefinition } from '../../core/interfaces.ts'
import { updatePlanTool } from './update_plan.ts'
import { ask_userTool } from './ask_user.ts'
import { read_fileTool } from './read_file.ts'
import { grepTool } from './grep.ts'
import { applyPatchTool } from './apply_patch.ts'
import { edit_fileTool } from './edit_file.ts'
import { write_fileTool } from './write_file.ts'
import { execCommandTool } from './exec_command.ts'
import { ExecCommandProcessManager } from './exec_command_process_manager.ts'
import { writeStdinTool } from './write_stdin.ts'
import type { PathPermissions } from './permissions.ts'
import type { CommandPermissions } from './command_permissions.ts'

export type BuiltinTool = ToolDefinition

export interface BuiltinToolDeps {
  enableTodos?: boolean
  clarificationHandler?: IClarificationHandler
  /** Path permission layer for the read tools (read_file/grep). */
  permissions?: PathPermissions
  /** Command-level policy for `exec_command` (deny enforced in every HITL mode). */
  commandPermissions?: CommandPermissions
  /** HITL handler for `ask` (outside-root) read approvals. */
  hitl?: IHITLHandler
  /** Responses custom tool names enabled for this agent/provider. */
  customToolNames?: readonly string[]
}

/**
 * Return all builtin tool entries, ready to register.
 *
 * Always includes the filesystem/shell family (`read_file`, `grep`,
 * `exec_command`, `write_stdin`) — without these the agent cannot
 * fulfil progressive-disclosure skill instructions (e.g. "read guides/x.md")
 * or operate on files at all. The mutating/executing ones carry standard tool
 * annotations so HITL gates them in strict/delegate modes. The read tools
 * additionally consult {@link PathPermissions} (deny in all modes, `ask` →
 * HITL in strict/delegate).
 *
 * `update_plan` and `ask_user` are only included when their deps are provided.
 */
export function registerBuiltinTools(deps: BuiltinToolDeps = {}): BuiltinTool[] {
  const readDeps = { permissions: deps.permissions, hitl: deps.hitl }
  const execCommandProcessManager = new ExecCommandProcessManager()
  const tools: BuiltinTool[] = [
    read_fileTool(readDeps),
    grepTool(readDeps),
    execCommandTool({
      ...(deps.commandPermissions ? { commandPermissions: deps.commandPermissions } : {}),
      processManager: execCommandProcessManager,
    }),
    writeStdinTool({ processManager: execCommandProcessManager }),
  ]
  if (deps.customToolNames?.includes('apply_patch')) {
    tools.push(applyPatchTool())
  } else {
    tools.push(write_fileTool(), edit_fileTool())
  }
  if (deps.enableTodos) {
    tools.push(updatePlanTool())
  }
  if (deps.clarificationHandler) {
    tools.push(ask_userTool(deps.clarificationHandler))
  }
  return tools
}
