// probe-proxy.mjs
// Node.js 24+ — zero deps, Promise.any + AbortController + RTT + cancels losers
import net from 'node:net'
import { performance } from 'node:perf_hooks'

class ProbeError extends Error {
  constructor(kind, detail) {
    super(`${kind} probe failed${detail ? `: ${detail}` : ''}`)
    this.name = 'ProbeError'
    this.kind = kind
  }
}

function withTimeout(ms, { signal } = {}) {
  const ac = new AbortController()
  const onAbort = () => ac.abort(signal?.reason ?? new Error('aborted'))
  if (signal)
    signal.addEventListener('abort', onAbort, { once: true })

  const t = setTimeout(() => ac.abort(new Error('timeout')), ms)
  ac.signal.addEventListener(
    'abort',
    () => {
      clearTimeout(t)
      if (signal)
        signal.removeEventListener('abort', onAbort)
    },
    { once: true },
  )

  return ac
}

function connectTcp({ host, port, timeoutMs = 3000, signal }) {
  return new Promise((resolve, reject) => {
    const socket = net.connect({ host, port })

    const cleanup = () => {
      socket.removeAllListeners()
    }

    const fail = (err) => {
      cleanup()
      try { socket.destroy() }
      catch {}
      reject(err)
    }

    const t = setTimeout(() => fail(new ProbeError('tcp', 'connect timeout')), timeoutMs)

    const onAbort = () => fail(new ProbeError('tcp', signal?.reason?.message ?? 'aborted'))
    if (signal) {
      if (signal.aborted)
        return onAbort()
      signal.addEventListener('abort', onAbort, { once: true })
    }

    socket.once('connect', () => {
      clearTimeout(t)
      if (signal)
        signal.removeEventListener('abort', onAbort)
      resolve(socket)
    })
    socket.once('error', (e) => {
      clearTimeout(t)
      if (signal)
        signal.removeEventListener('abort', onAbort)
      fail(new ProbeError('tcp', e.message))
    })
  })
}

function waitData(socket, { timeoutMs = 3000, signal } = {}) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new ProbeError('io', 'read timeout')), timeoutMs)

    const onAbort = () => {
      clearTimeout(t)
      reject(new ProbeError('io', signal?.reason?.message ?? 'aborted'))
    }
    if (signal) {
      if (signal.aborted)
        return onAbort()
      signal.addEventListener('abort', onAbort, { once: true })
    }

    socket.once('data', (buf) => {
      clearTimeout(t)
      if (signal)
        signal.removeEventListener('abort', onAbort)
      resolve(buf)
    })
    socket.once('error', (e) => {
      clearTimeout(t)
      if (signal)
        signal.removeEventListener('abort', onAbort)
      reject(new ProbeError('io', e.message))
    })
    socket.once('close', () => {
      clearTimeout(t)
      if (signal)
        signal.removeEventListener('abort', onAbort)
      reject(new ProbeError('io', 'socket closed'))
    })
  })
}

async function probeHttpConnect({
  proxyHost,
  proxyPort,
  targetHost = 'www.google.com',
  targetPort = 443,
  timeoutMs = 4000,
  signal,
} = {}) {
  const t0 = performance.now()
  const ac = withTimeout(timeoutMs, { signal })

  const socket = await connectTcp({
    host: proxyHost,
    port: proxyPort,
    timeoutMs,
    signal: ac.signal,
  })

  try {
    socket.setNoDelay(true)
    socket.write(
      `CONNECT ${targetHost}:${targetPort} HTTP/1.1\r\n`
      + `Host: ${targetHost}:${targetPort}\r\n`
      + `Proxy-Connection: Keep-Alive\r\n`
      + `Connection: Keep-Alive\r\n`
      + `\r\n`,
    )

    const buf = await waitData(socket, { timeoutMs, signal: ac.signal })
    const s = buf.toString('utf8')
    if (!/^HTTP\/1\.[01] 200/i.test(s)) {
      throw new ProbeError('http', s.split('\r\n')[0] || 'bad response')
    }

    return {
      kind: 'http',
      ok: true,
      rttMs: Math.round(performance.now() - t0),
    }
  }
  finally {
    try { socket.destroy() }
    catch {}
  }
}

async function probeSocks5({
  proxyHost,
  proxyPort,
  targetHost = 'www.google.com',
  targetPort = 443,
  timeoutMs = 4000,
  signal,
} = {}) {
  const t0 = performance.now()
  const ac = withTimeout(timeoutMs, { signal })

  const socket = await connectTcp({
    host: proxyHost,
    port: proxyPort,
    timeoutMs,
    signal: ac.signal,
  })

  try {
    socket.setNoDelay(true)

    // 1) greeting: VER=5, NMETHODS=1, METHOD=0 (no auth)
    socket.write(Buffer.from([0x05, 0x01, 0x00]))
    const sel = await waitData(socket, { timeoutMs, signal: ac.signal })
    if (sel[0] !== 0x05 || sel[1] !== 0x00) {
      throw new ProbeError('socks5', 'method not accepted')
    }

    // 2) connect: VER=5, CMD=1, RSV=0, ATYP=3 (domain), DST.ADDR, DST.PORT
    const hostBuf = Buffer.from(targetHost, 'utf8')
    const portBuf = Buffer.from([(targetPort >> 8) & 0xFF, targetPort & 0xFF])
    const req = Buffer.concat([
      Buffer.from([0x05, 0x01, 0x00, 0x03, hostBuf.length]),
      hostBuf,
      portBuf,
    ])

    socket.write(req)
    const rep = await waitData(socket, { timeoutMs, signal: ac.signal })
    // REP at byte 1; 0x00 = succeeded
    if (rep[0] !== 0x05 || rep[1] !== 0x00) {
      throw new ProbeError('socks5', `REP=${rep[1] ?? '??'}`)
    }

    return {
      kind: 'socks5',
      ok: true,
      rttMs: Math.round(performance.now() - t0),
    }
  }
  finally {
    try { socket.destroy() }
    catch {}
  }
}

/**
 * 最现代化“最优解”：
 * - 并发探活 HTTP + SOCKS5
 * - Promise.any 取最快成功
 * - 一旦成功立刻 abort 其他探测（省时间/省资源）
 * - 返回 RTT
 */
export async function probeBestProxy({
  http, // { host, port } or null
  socks5, // { host, port } or null
  targetHost = 'www.google.com',
  targetPort = 443,
  timeoutMs = 4000,
} = {}) {
  const master = new AbortController()

  const tasks = []
  if (http?.host && http?.port) {
    tasks.push(
      probeHttpConnect({
        proxyHost: http.host,
        proxyPort: http.port,
        targetHost,
        targetPort,
        timeoutMs,
        signal: master.signal,
      }).catch((e) => {
        throw new ProbeError('http', e?.message)
      }),
    )
  }
  if (socks5?.host && socks5?.port) {
    tasks.push(
      probeSocks5({
        proxyHost: socks5.host,
        proxyPort: socks5.port,
        targetHost,
        targetPort,
        timeoutMs,
        signal: master.signal,
      }).catch((e) => {
        throw new ProbeError('socks5', e?.message)
      }),
    )
  }

  if (tasks.length === 0)
    throw new Error('No proxies provided')

  try {
    const winner = await Promise.any(tasks)
    master.abort(new Error('winner chosen'))
    return winner
  }
  catch (err) {
    // Promise.any 全失败 => AggregateError
    const reasons = err?.errors?.map(e => e?.message).filter(Boolean)
    const msg = reasons?.length ? reasons.join(' | ') : (err?.message ?? 'all failed')
    throw new Error(`All probes failed: ${msg}`)
  }
}

const res = await probeBestProxy({
  http: { host: '127.0.0.1', port: 10809 },
  socks5: { host: '127.0.0.1', port: 10809 },
  // targetHost: 'www.google.com',
  // targetPort: 443,
  timeoutMs: 4000,
}).catch((e) => {
  console.error('666:', e.message)
  process.exitCode = 1
})

console.log('res', res)
