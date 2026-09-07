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
  usedDirIds: readonly string[],
  unusedDirIds: readonly string[],
  usedAsUnusedDirIds: readonly string[],
): string {
  const reported = new Set(reportedDirIds)
  const admitted = new Set(admittedDirIds)
  const missingUsed = usedDirIds.filter(dirId => !reported.has(dirId))
  const outsideScope = reportedDirIds.filter(dirId => !admitted.has(dirId))

  return [
    '## Task report validation failed',
    '',
    'The report was not accepted. Include one success or failure result for every window that was started, and omit other windows or mark them as unused.',
    '',
    ...(missingUsed.length > 0 ? [`- Missing started windows: ${missingUsed.join(', ')}`] : []),
    ...(admittedDirIds.length === 0 ? ['- No non-empty profile id was found in the user message; do not call roxy_task_report.'] : []),
    ...(outsideScope.length > 0 ? [`- Windows outside the message scope: ${outsideScope.join(', ')}`] : []),
    ...(unusedDirIds.length > 0 ? [`- Unused windows must be omitted or use status=unused: ${unusedDirIds.join(', ')}`] : []),
    ...(usedAsUnusedDirIds.length > 0 ? [`- Started windows cannot use status=unused: ${usedAsUnusedDirIds.join(', ')}`] : []),
    '',
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
      'Use the user\'s system language for taskName and keep it short.',
      'For each parameter, provide a concise key, a brief user-facing name, and a primitive value.',
      'Keep parameter keys and values concise and within the schema limits.',
      'Use only dirIds parsed from the user profile references; those references are the report admission set.',
      'If the user message contains no non-empty profile id (including [@profile:0]()), do not call this tool because no window id is admissible.',
      'Include every admitted window successfully started by the main agent, a subagent, or a batch script exactly once; those are the used windows.',
      'A referenced window that was never started may be omitted; if included, use exactly success=false, status=unused, and failureReason="".',
      'Do not invent ids, report windows outside the user profile references, or treat a merely selected window as a success or failure.',
      'A started window must omit status and use success=true with failureReason="", or success=false with a concise non-empty failureReason.',
      'Example: admission [A,B,C,D] with only A started => [{dirId:"A",success:true,failureReason:""}] or append B/C/D as success=false,status=unused,failureReason="".',
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
        const admittedDirIds = tracker.admittedSnapshot()
        const usedDirIds = tracker.snapshot()
        const reportWindows = (input as { windows: Array<{ dirId: string, status?: 'unused' }> }).windows
        const reportDirIds = reportWindows.map(window => window.dirId)
        const admitted = new Set(admittedDirIds)
        const used = new Set(usedDirIds)
        const reported = new Set(reportDirIds)
        const unusedDirIds = reportWindows
          .filter(window => !used.has(window.dirId) && window.status !== 'unused')
          .map(window => window.dirId)
        const usedAsUnusedDirIds = reportWindows
          .filter(window => used.has(window.dirId) && window.status === 'unused')
          .map(window => window.dirId)
        const invalid = usedDirIds.some(dirId => !reported.has(dirId))
          || reportDirIds.some(dirId => !admitted.has(dirId))
          || usedDirIds.some(dirId => !admitted.has(dirId))
          || unusedDirIds.length > 0
          || usedAsUnusedDirIds.length > 0
        if (invalid) {
          return {
            content: formatWindowCoverageError(
              reportDirIds,
              admittedDirIds,
              usedDirIds,
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
