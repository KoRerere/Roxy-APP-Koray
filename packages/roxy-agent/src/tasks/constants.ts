import os from 'node:os'

export const MAX_PARALLEL_WORKERS = 20
export const DEFAULT_SCRIPT_TASK_CONCURRENCY = os.cpus().length + 2

export const TASK_HEARTBEAT_INTERVAL_MS = 15_000
export const TASK_HEARTBEAT_MAX_FAILURES = 3
export const TASK_LEASE_START_MAX_ATTEMPTS = 3
export const TASK_LEASE_START_RETRY_BASE_DELAY_MS = 200
export const TASK_SYNC_INTERVAL_MS = 60_000
export const TASK_TRIGGER_LEEWAY_MS = 5 * 60_000

export const MAX_TIMER_DELAY_MS = 2_147_483_647
