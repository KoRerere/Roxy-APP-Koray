export interface TaskReportWindowTracker {
  beginTurn: (admittedDirIds?: readonly string[]) => void
  record: (dirIds: readonly string[]) => void
  /** 整个会话内已成功启动的窗口。 */
  snapshot: () => string[]
  /** 当前轮次引用的窗口，可作为未使用项展示。 */
  admittedSnapshot: () => string[]
}

export function createTaskReportWindowTracker(options: {
  usedDirIds?: readonly string[]
  onWindowUsed?: (dirId: string) => void
} = {}): TaskReportWindowTracker {
  const admittedDirIds = new Set<string>()
  const usedDirIds = new Set(options.usedDirIds?.map(dirId => dirId.trim()).filter(Boolean))

  return {
    beginTurn(values = []) {
      admittedDirIds.clear()
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
        if (dirId && !usedDirIds.has(dirId)) {
          options.onWindowUsed?.(dirId)
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
