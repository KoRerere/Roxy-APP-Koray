import axios from 'axios'
import { performance } from 'node:perf_hooks'
import { getBaseUrl, getGatewayConfig } from '/@/api/getGatewayConfig'
import { dictStore } from '/@/modules/dict'
import { electronAdapter } from '/@/utils/request/electronAdapter'

const PROBE_TIMEOUT_MS = 5000
/** 自动线路延迟更新事件标识，与具体 gate 探测回调共用 */
export const AUTO_GATE_LATENCY_KEY = '__auto__'

/** gate 主机名 -> 延迟 ms，null 表示探测失败 */
const latencyCache = new Map<string, number | null>()

type GateLatencyListener = (gate: string) => void
type ProbeBatchCompleteListener = () => void
const latencyListeners = new Set<GateLatencyListener>()
const probeBatchCompleteListeners = new Set<ProbeBatchCompleteListener>()

/** 注册线路延迟更新监听，每条线路探测完成后触发 */
export function onGateLatencyUpdated(listener: GateLatencyListener) {
  latencyListeners.add(listener)
  return () => latencyListeners.delete(listener)
}

/** 注册探测批次完成监听，整轮 refreshNodeLatencies 结束后触发 */
export function onProbeBatchComplete(listener: ProbeBatchCompleteListener) {
  probeBatchCompleteListeners.add(listener)
  return () => probeBatchCompleteListeners.delete(listener)
}

function notifyProbeBatchComplete() {
  probeBatchCompleteListeners.forEach(listener => listener())
}

function notifyGateLatencyUpdated(gate: string) {
  latencyListeners.forEach(listener => listener(gate))
}

function probeSingleGate(gate: string): Promise<number | null> {
  const t0 = performance.now()
  return axios.get(`https://${gate}/vgo/gateway`, {
    // adapter: electronAdapter,
    proxy: false,
    timeout: PROBE_TIMEOUT_MS,
    validateStatus: () => true,
  })
    .then(() => Math.round(performance.now() - t0))
    .catch(() => null)
}

/** 从网关 baseUrl 提取主机名 */
function extractGateHostname(baseUrl: string): string | null {
  if (!baseUrl)
    return null
  try {
    return new URL(baseUrl.startsWith('http') ? baseUrl : `https://${baseUrl}`).hostname
  }
  catch {
    return null
  }
}

/** 与 api/index.ts 一致：优先 getBaseUrl，否则拉取 getGatewayConfig */
async function resolveAutoGateHostname(): Promise<string | null> {
  const cached = extractGateHostname(getBaseUrl())
  if (cached)
    return cached
  try {
    const baseUrl = await getGatewayConfig()
    return extractGateHostname(baseUrl)
  }
  catch {
    return null
  }
}

/** 自动线路延迟：取当前 getBaseUrl 对应网关的探测结果 */
export function getAutoGateLatency(): number | null | undefined {
  const hostname = extractGateHostname(getBaseUrl())
  if (!hostname)
    return undefined
  if (!latencyCache.has(hostname))
    return undefined
  return latencyCache.get(hostname) ?? null
}

/** 格式化自动线路延迟文案 */
export function formatAutoGateLatency(): string {
  const latency = getAutoGateLatency()
  if (latency === undefined)
    return '(...)'
  if (latency === null)
    return '(--)'
  return `(${latency}ms)`
}

/** 格式化线路延迟文案，未探测显示 (...)，失败显示 (--) */
export function formatGateLatency(gate: string): string {
  if (!latencyCache.has(gate))
    return '(...)'
  const latency = latencyCache.get(gate)
  if (latency === null)
    return '(--)'
  return `(${latency}ms)`
}

let probeGeneration = 0

/** 并发探测所有线路延迟并刷新缓存 */
export async function refreshNodeLatencies(): Promise<void> {
  const generation = ++probeGeneration
  const autoGateHostname = await resolveAutoGateHostname()
  const nodes = dictStore.network_node
  const gatesToProbe = [...new Set([
    ...nodes.map(node => node.gate),
    ...(autoGateHostname ? [autoGateHostname] : []),
  ])]

  if (!gatesToProbe.length)
    return

  // getGatewayConfig 完成后先刷新一次自动线路文案
  notifyGateLatencyUpdated(AUTO_GATE_LATENCY_KEY)

  console.debug('[probe-gate-latency] start probing', gatesToProbe)
  await Promise.all(
    gatesToProbe.map(async (gate) => {
      const latency = await probeSingleGate(gate)
      if (generation !== probeGeneration)
        return
      latencyCache.set(gate, latency)
      console.debug('[probe-gate-latency] result', gate, latency === null ? 'failed' : `${latency}ms`)
      notifyGateLatencyUpdated(gate)
      if (gate === autoGateHostname)
        notifyGateLatencyUpdated(AUTO_GATE_LATENCY_KEY)
    }),
  )

  if (generation === probeGeneration) {
    notifyGateLatencyUpdated(AUTO_GATE_LATENCY_KEY)
    notifyProbeBatchComplete()
  }
}
