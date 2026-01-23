// abortRegistry.ts
interface AbortEntry {
  controller: AbortController
  createdAt: number
}

const registry = new Map<string, AbortEntry>()

export function createAbort(runId: string) {
  const controller = new AbortController()
  registry.set(runId, { controller, createdAt: Date.now() })
  return controller
}

export function abortRun(runId: string) {
  const entry = registry.get(runId)
  if (!entry)
    return false
  entry.controller.abort('User cancelled')
  registry.delete(runId)
  return true
}

export function cleanupRun(runId: string) {
  registry.delete(runId)
}

export class AbortError extends Error {
  public readonly isAbortError = true

  constructor(message: string) {
    super(message)
    this.name = 'AbortError'
  }

  static isAbortError(error: any): error is AbortError {
    return error instanceof AbortError || (error?.isAbortError && error.isAbortError) || error.name === "AbortError"
  }
}
