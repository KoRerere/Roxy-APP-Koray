import type { TaskReportWindowTracker } from './task-report-window-tracker'
import type { ToolDefinition } from 'roxy-agent-runtime'
import {
  formatTaskReportValidationError,
  TaskReportInputSchema,
} from '@roxy/shared'
import { defineTool } from 'roxy-agent-runtime'

export const TASK_REPORT_TOOL_NAME = 'roxy_task_report'

const TASK_REPORT_ACCEPTED_MARKDOWN = '## Task report result\n\n- status: accepted'

function formatWindowCoverageError(
  reportedDirIds: readonly string[],
  admittedDirIds: readonly string[],
  unusedDirIds: readonly string[],
  usedAsUnusedDirIds: readonly string[],
): string {
  const admitted = new Set(admittedDirIds)
  const outsideScope = reportedDirIds.filter(dirId => !admitted.has(dirId))

  return [
    '## Task report validation failed',
    '',
    'The report was not accepted. Use windows actually started in this conversation, or current profile references marked as unused if never started.',
    '',
    ...(admittedDirIds.length === 0 ? ['- No used or currently referenced windows are available; do not call roxy_task_report.'] : []),
    ...(outsideScope.length > 0 ? [`- Windows outside the report scope: ${outsideScope.join(', ')}`] : []),
    ...(unusedDirIds.length > 0 ? [`- Unused windows must be omitted or use status=unused: ${unusedDirIds.join(', ')}`] : []),
    ...(usedAsUnusedDirIds.length > 0 ? [`- Started windows cannot use status=unused: ${usedAsUnusedDirIds.join(', ')}`] : []),
    '',
    'Report the current turn by default; follow the requested scope when the user asks to regenerate or summarize earlier work.',
    'For started windows, set success=true with an empty failureReason, or success=false with a concise failureReason.',
  ].join('\n')
}

/** Register the root-only report tool. The persisted tool input is the report data source. */
export function createTaskReportTool(options: { windowTracker?: TaskReportWindowTracker } = {}): ToolDefinition {
  return defineTool({
    name: TASK_REPORT_TOOL_NAME,
    description: [
      'Record the final structured result of a browser execution task.',
      'Call this alone after all operational tools finish when a per-window outcome report is useful.',
      'Default to the current turn: include every window used by the main agent, subagents, or batch scripts in this turn exactly once, including failed outcomes.',
      'When the user asks to regenerate a report or summarize earlier work, use the requested task and window scope from this conversation instead.',
      'Historical windows are available for these requests; do not add unrelated earlier windows to an ordinary current-turn report.',
      'Base outcomes on the execution evidence for the work being reported; do not relaunch windows or repeat operations just to generate a report.',
      'Use the user\'s system language for taskName and keep it short.',
      'For each parameter, provide a concise key, a brief user-facing name, and a primitive value.',
      'Keep parameter keys and values concise and within the schema limits.',
      'Use only dirIds actually started in this conversation, plus current user profile references for optional unused entries.',
      'A currently referenced window that was never started in this conversation may be omitted; if included, use exactly success=false, status=unused, and failureReason="".',
      'Do not invent ids or treat a merely selected window as a success or failure. Skip the tool if no eligible window exists.',
      'A started window must omit status and use success=true with failureReason="", or success=false with a concise non-empty failureReason.',
    ].join(' '),
    inputSchema: TaskReportInputSchema,
    source: 'builtin',
    returnDirect: true,
    formatInputError: formatTaskReportValidationError,
    annotations: { readOnlyHint: true, openWorldHint: false },
    handler: async (input, ctx) => {
      const tracker = options.windowTracker
        ?? (ctx.metadata?.taskReportWindowTracker as TaskReportWindowTracker | undefined)
      if (tracker) {
        const usedDirIds = tracker.snapshot()
        const admittedDirIds = [...new Set([...tracker.admittedSnapshot(), ...usedDirIds])]
        const reportWindows = (input as { windows: Array<{ dirId: string, status?: 'unused' }> }).windows
        const reportDirIds = reportWindows.map(window => window.dirId)
        const admitted = new Set(admittedDirIds)
        const used = new Set(usedDirIds)
        const unusedDirIds = reportWindows
          .filter(window => !used.has(window.dirId) && window.status !== 'unused')
          .map(window => window.dirId)
        const usedAsUnusedDirIds = reportWindows
          .filter(window => used.has(window.dirId) && window.status === 'unused')
          .map(window => window.dirId)
        const invalid = reportDirIds.some(dirId => !admitted.has(dirId))
          || unusedDirIds.length > 0
          || usedAsUnusedDirIds.length > 0
        if (invalid) {
          return {
            content: formatWindowCoverageError(
              reportDirIds,
              admittedDirIds,
              unusedDirIds,
              usedAsUnusedDirIds,
            ),
            isError: true,
            errorKind: 'input_invalid' as const,
          }
        }
      }

      return {
        content: TASK_REPORT_ACCEPTED_MARKDOWN,
        isError: false,
      }
    },
  })
}
