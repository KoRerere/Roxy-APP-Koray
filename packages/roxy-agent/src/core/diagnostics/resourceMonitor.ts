import * as v8 from 'node:v8'

export type MetricReceiver = (line: string) => void

export interface ResourceMonitorOptions {
  label: string
  intervalMs: number
  receiver: MetricReceiver
  extras?: () => Record<string, number | string>
}

function formatBytes(bytes: number): string {
  const mb = bytes / (1024 * 1024)
  return `${mb.toFixed(1)}MB`
}

function formatSample(
  label: string,
  mem: NodeJS.MemoryUsage,
  heap: v8.HeapInfo,
  cpuUserMs: number,
  cpuSysMs: number,
  cpuPct: number,
  extras: Record<string, number | string>,
): string {
  const parts = [
    `[resource:${label}]`,
    `rss=${formatBytes(mem.rss)}`,
    `heap=${formatBytes(mem.heapUsed)}/${formatBytes(mem.heapTotal)}`,
    `ext=${formatBytes(mem.external)}`,
    `arr=${formatBytes(mem.arrayBuffers)}`,
    `| v8 used=${formatBytes(heap.used_heap_size)} total=${formatBytes(heap.total_heap_size)} malloced=${formatBytes(heap.malloced_memory)} peak=${formatBytes(heap.peak_malloced_memory)}`,
    `ctx=native:${heap.number_of_native_contexts}/detached:${heap.number_of_detached_contexts}`,
    `| cpu user=${cpuUserMs.toFixed(0)}ms sys=${cpuSysMs.toFixed(0)}ms ${cpuPct.toFixed(1)}%`,
  ]
  const extraEntries = Object.entries(extras)
  if (extraEntries.length > 0) {
    const extraLine = extraEntries.map(([k, v]) => `${k}=${v}`).join(' ')
    parts.push(`| ${extraLine}`)
  }
  return parts.join(' ')
}

export function startResourceMonitor(options: ResourceMonitorOptions): () => void {
  let lastCpu = process.cpuUsage()
  let lastHr = process.hrtime.bigint()

  const sample = () => {
    const mem = process.memoryUsage()
    const heap = v8.getHeapStatistics()

    const cpu = process.cpuUsage()
    const now = process.hrtime.bigint()
    const elapsedMs = Number(now - lastHr) / 1e6
    const cpuUserMs = (cpu.user - lastCpu.user) / 1000
    const cpuSysMs = (cpu.system - lastCpu.system) / 1000
    const cpuPct = elapsedMs > 0 ? ((cpuUserMs + cpuSysMs) / elapsedMs) * 100 : 0
    lastCpu = cpu
    lastHr = now

    let extras: Record<string, number | string> = {}
    if (options.extras) {
      try {
        extras = options.extras() ?? {}
      }
      catch {}
    }

    const line = formatSample(options.label, mem, heap, cpuUserMs, cpuSysMs, cpuPct, extras)
    try {
      options.receiver(line)
    }
    catch {}
  }

  const timer = setInterval(sample, options.intervalMs)
  timer.unref()
  return () => {
    clearInterval(timer)
  }
}
