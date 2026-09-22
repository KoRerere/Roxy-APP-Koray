import os from 'node:os'

export const MAX_PARALLEL_WORKERS = 20
export const DEFAULT_SCRIPT_TASK_CONCURRENCY = os.cpus().length + 2

export const TASK_SYNC_INTERVAL_MS = 60_000
export const TASK_TRIGGER_LEEWAY_MS = 5 * 60_000

export const MAX_TIMER_DELAY_MS = 2_147_483_647
