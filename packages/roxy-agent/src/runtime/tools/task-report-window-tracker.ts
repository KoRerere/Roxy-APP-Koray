export interface TaskReportWindowTracker {
  beginTurn: (admittedDirIds?: readonly string[]) => void
  record: (dirIds: readonly string[]) => void
  snapshot: () => string[]
  admittedSnapshot: () => string[]
}

export function createTaskReportWindowTracker(): TaskReportWindowTracker {
  const admittedDirIds = new Set<string>()
  const usedDirIds = new Set<string>()

  return {
    beginTurn(values = []) {
      admittedDirIds.clear()
      usedDirIds.clear()
      for (const value of values) {
        const dirId = value.trim()
        if (dirId) {
          admittedDirIds.add(dirId)
        }
      }
    },
    record(values) {
      for (const value of values) {
        const dirId = value.trim()
        if (dirId) {
          usedDirIds.add(dirId)
        }
      }
    },
    snapshot() {
      return [...usedDirIds]
    },
    admittedSnapshot() {
      return [...admittedDirIds]
    },
  }
}
