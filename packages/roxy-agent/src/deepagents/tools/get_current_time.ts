import type { StructuredToolInterface } from '@langchain/core/tools'
import { tool } from 'langchain'
import { z } from 'zod'

const pad = (n: number) => String(n).padStart(2, '0')

function formatLocal(date: Date): string {
  // Use local components (not UTC) to match the process system timezone
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
    + ` ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

function formatOffset(date: Date): string {
  // getTimezoneOffset returns UTC - local (UTC+8 returns -480)
  const offsetMin = -date.getTimezoneOffset()
  const sign = offsetMin >= 0 ? '+' : '-'
  const abs = Math.abs(offsetMin)
  return `UTC${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
}

/**
 * Returns the current local time. Agents should call this tool when writing time
 * values instead of using `new Date().toISOString()` (which returns UTC).
 */
export const getCurrentTimeTool: StructuredToolInterface = tool(
  async () => {
    const now = new Date()
    let tz = 'UTC'
    try {
      tz = Intl.DateTimeFormat().resolvedOptions().timeZone || tz
    }
    catch {
      // Minimal runtimes may lack Intl timezone resolution; fall back to UTC
    }
    return [
      `Current local time: ${formatLocal(now)}`,
      `Timezone: ${tz} (${formatOffset(now)})`,
      `Millisecond timestamp: ${now.getTime()} (pass this number to date/time-typed fields, not a string)`,
    ].join('\n')
  },
  {
    name: 'get_current_time',
    description: 'Get the current local time, timezone, and millisecond timestamp. Call this when you need to write a time value; do not use new Date().toISOString() (it returns UTC).',
    schema: z.object({}),
  },
) as unknown as StructuredToolInterface
