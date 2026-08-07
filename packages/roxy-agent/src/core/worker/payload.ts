import type { WorkerPayload } from './protocol'
import fs from 'node:fs/promises'

export async function loadWorkerPayload(): Promise<WorkerPayload> {
  const args = process.argv.slice(3)
  const flagIndex = args.indexOf('--payload-file')
  if (flagIndex === -1 || !args[flagIndex + 1]) {
    console.error('[worker] Missing required argument: --payload-file')
    process.exit(2)
  }

  const payloadPath = args[flagIndex + 1]

  let raw: string
  try {
    raw = await fs.readFile(payloadPath, 'utf8')
  }
  catch (err: any) {
    console.error(`[worker] Failed to read payload file: ${payloadPath}`, err.message)
    process.exit(2)
  }

  let payload: any
  try {
    payload = JSON.parse(raw!)
  }
  catch (err: any) {
    console.error('[worker] Failed to parse payload JSON:', err.message)
    process.exit(2)
  }

  validatePayload(payload)
  return payload as WorkerPayload
}

function validatePayload(payload: WorkerPayload) {
  if (payload.protocolVersion !== 1) {
    console.error(`[worker] Unsupported protocolVersion: ${payload.protocolVersion}`)
    process.exit(2)
  }
  if (!payload.workerId || typeof payload.workerId !== 'string') {
    console.error('[worker] Invalid payload: workerId must be a non-empty string')
    process.exit(2)
  }
  if (!payload.parentRunId || typeof payload.parentRunId !== 'string') {
    console.error('[worker] Invalid payload: parentRunId must be a non-empty string')
    process.exit(2)
  }
  if (!payload.conversationId || typeof payload.conversationId !== 'string') {
    console.error('[worker] Invalid payload: conversationId must be a non-empty string')
    process.exit(2)
  }
  if (!payload.task || typeof payload.task !== 'string') {
    console.error('[worker] Invalid payload: task must be a non-empty string')
    process.exit(2)
  }
  if (!Number.isInteger(payload.timeoutMs) || payload.timeoutMs <= 0) {
    console.error('[worker] Invalid payload: timeoutMs must be a positive integer')
    process.exit(2)
  }
}
