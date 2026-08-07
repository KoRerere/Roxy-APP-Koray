function getPerfStart() {
  const perfState = globalThis as typeof globalThis & { __roxyPerfStart?: number }
  perfState.__roxyPerfStart ??= performance.now()
  return perfState.__roxyPerfStart
}

function formatDuration(ms: number) {
  return `${Math.round(ms)}ms`
}

export function perfLog(label: string, data?: Record<string, unknown>) {
  const now = performance.now()
  const elapsed = formatDuration(now - getPerfStart())
  if (data) {
    console.log(`[perf][agent-load][+${elapsed}] ${label}`, data)
    return
  }
  console.log(`[perf][agent-load][+${elapsed}] ${label}`)
}

export function createPerfTimer(label: string, data?: Record<string, unknown>) {
  const start = performance.now()
  perfLog(`${label}:start`, data)
  return (endData?: Record<string, unknown>) => {
    perfLog(`${label}:end`, {
      duration: formatDuration(performance.now() - start),
      ...endData,
    })
  }
}
