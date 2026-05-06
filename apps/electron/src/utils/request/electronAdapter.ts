/**
 * Electron `net.request` 的 axios 适配层。
 *
 * 设计目标：让 axios 走 Chromium 的网络协议栈（系统代理 / wpad / pac、HTTPS 隧道、
 * Cookie 会话、各种代理认证），同时保留 axios 的 API 语义。
 *
 * 选 `net.request` 而不是 `net.fetch`：
 *   - 它返回的 `ClientRequest` 在运行时继承 Node `Writable`，`IncomingMessage` 继承 Node `Readable`，
 *     可以直接 `pipeline` + `for await ... of`，对大文件流式上传/下载最友好（自动背压）。
 *   - 对应地，`net.fetch` 的 `ReadableStream` 上传需要 `duplex: 'half'` 且原生不支持上传进度。
 *
 * 注意：Electron 的 `.d.ts` 把 `ClientRequest` / `IncomingMessage` 都仅声明为 `NodeEventEmitter`，
 * 没有暴露其继承自 `Writable` / `Readable` 的事实。本文件中少量 `as unknown as Writable/Readable`
 * 的 cast 都是为弥补这个类型缺口，runtime 行为是保证的。
 */

import type { AxiosProgressEvent, AxiosResponse, GenericAbortSignal, InternalAxiosRequestConfig, ResponseType } from 'axios'
import type { ClientRequest as ElectronClientRequest, IncomingMessage as ElectronIncomingMessage } from 'electron'
import type { Writable } from 'node:stream'
import type { ReadableStream as NodeReadableStream } from 'node:stream/web'
import { AxiosError, AxiosHeaders, CanceledError } from 'axios'
import { net } from 'electron'
import { Buffer } from 'node:buffer'
import { performance } from 'node:perf_hooks'
import { Readable, Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'

const ABSOLUTE_URL_RE = /^(?:[a-z][\w+\-.]*:)?\/\//i

/** AbortSignal.reason 在类型上是 unknown，运行时也可能是字符串/任意值，统一规范成 Error。 */
function toError(reason: unknown): Error {
  return reason instanceof Error ? reason : new Error(typeof reason === 'string' ? reason : 'aborted')
}

// =====================================================================
// URL 与参数处理
// =====================================================================

/** 等价于 axios 内部的 buildFullPath：相对路径才拼 baseURL，绝对路径直通。 */
function buildFullPath(baseURL: string | undefined, url: string): string {
  if (!baseURL || ABSOLUTE_URL_RE.test(url))
    return url
  return `${baseURL.replace(/\/+$/, '')}/${url.replace(/^\/+/, '')}`
}

/**
 * 序列化 `config.params`，兼容 axios v1 的两种 paramsSerializer 形态：
 *   - 函数：`(params) => string`
 *   - 对象：`{ serialize, encode, indexes }`
 */
function serializeParams(
  params: unknown,
  serializer: InternalAxiosRequestConfig['paramsSerializer'],
): string {
  if (params == null)
    return ''
  if (typeof serializer === 'function')
    return serializer(params)
  if (
    serializer
    && typeof serializer === 'object'
    && typeof serializer.serialize === 'function'
  ) {
    return serializer.serialize(params)
  }
  if (params instanceof URLSearchParams)
    return params.toString()
  if (typeof params === 'string')
    return params
  // 其它形态（普通对象 / 二维数组 / 可迭代对象）都能被 URLSearchParams 直接接受
  return new URLSearchParams(params as Record<string, string>).toString()
}

function appendParams(
  url: string,
  params: unknown,
  serializer: InternalAxiosRequestConfig['paramsSerializer'],
): string {
  const query = serializeParams(params, serializer)
  if (!query)
    return url
  return url + (url.includes('?') ? '&' : '?') + query
}

// =====================================================================
// 类型守卫与 Buffer 转换
// =====================================================================

function isNodeReadable(value: unknown): value is Readable {
  return value instanceof Readable
}

function isWebReadableStream(value: unknown): value is NodeReadableStream<Uint8Array> {
  return value instanceof ReadableStream
}

/** 把任意二进制载体收敛到 Node `Buffer`，避免下游分支爆炸。 */
function toBuffer(value: Buffer | Uint8Array | ArrayBuffer): Buffer {
  if (Buffer.isBuffer(value))
    return value
  if (value instanceof ArrayBuffer)
    return Buffer.from(value)
  // Uint8Array 可能只是 ArrayBuffer 的一个视图，需要保留 offset / length
  return Buffer.from(value.buffer, value.byteOffset, value.byteLength)
}

// =====================================================================
// 进度上报
// =====================================================================

/**
 * 工厂返回一个累加上报函数。
 * 用 `performance.now()` 而不是 `Date.now()`，避免系统时钟跳变导致 rate 抖动。
 * 业务回调里抛出的异常不能影响请求主流程，因此整个调用是无 try/catch 的——
 * 调用方需要自己保证回调不抛。
 */
function makeProgressReporter(
  callback: ((event: AxiosProgressEvent) => void) | undefined,
  total: number | undefined,
  isUpload: boolean,
): (chunkLength: number) => void {
  if (!callback)
    return () => {}
  let loaded = 0
  const startTime = performance.now()
  return (chunkLength) => {
    loaded += chunkLength
    const elapsed = Math.max(1, performance.now() - startTime)
    const rate = (loaded / elapsed) * 1000
    callback({
      loaded,
      total,
      progress: total ? Math.min(loaded / total, 1) : undefined,
      bytes: chunkLength,
      rate,
      estimated: total && rate > 0 ? (total - loaded) / rate : undefined,
      lengthComputable: total !== undefined,
      ...(isUpload ? { upload: true } : { download: true }),
    })
  }
}

// =====================================================================
// 响应体反序列化
// =====================================================================

/**
 * 根据 axios `responseType` 把 buffer 转换成对应类型。
 * `'stream'` 不会走这里——上游会在拿到 IncomingMessage 时直接返回。
 */
function transformResponseData(buffer: Buffer, responseType: ResponseType | undefined): unknown {
  switch (responseType) {
    case 'arraybuffer':
      // 切片复制，避免暴露内部 Buffer pool 的共享内存
      return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
    case 'blob': {
      // 必须 copy 到新的 ArrayBuffer，否则 TS BlobPart 不接受 ArrayBufferLike
      const ab = new ArrayBuffer(buffer.byteLength)
      new Uint8Array(ab).set(buffer)
      return new Blob([ab])
    }
    case 'json':
      return buffer.length ? JSON.parse(buffer.toString('utf-8')) : null
    default:
      // 'text' | 'document' | undefined 都按文本处理；axios 的 transformResponse
      // 会在外层根据情况再次尝试 JSON.parse，行为和默认 http 适配器一致。
      return buffer.toString('utf-8')
  }
}

/**
 * Electron 的响应头值可能是 string | string[]；axios 期望的是扁平字符串字典，
 * 这里按 HTTP 语义用 ", " 拼接多值，并统一小写 key 方便业务侧消费。
 */
function normalizeResponseHeaders(
  raw: Record<string, string | string[]> | undefined,
): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(raw ?? {}))
    out[key.toLowerCase()] = Array.isArray(value) ? value.join(', ') : value
  return out
}

// =====================================================================
// 上传：把 axios `data` 写入 ClientRequest
// =====================================================================

/**
 * 把请求体送入 `ClientRequest`：
 *   - 流式数据（Node Readable / Web ReadableStream）走 `pipeline`，
 *     由 `Transform` 顺带做字节计数，pipeline 自动处理背压与错误向下游传播。
 *   - 非流式数据收敛到一个 Buffer 后一次性 `req.end(buf)`。
 *
 * 这里没有显式 try/catch：流式分支让 `pipeline` 抛错给调用方；非流式分支
 * 一次性 end，错误会以 `req` 的 `error` 事件呈现，由外层统一捕获。
 */
async function pipeUpload(
  req: ElectronClientRequest,
  data: unknown,
  reportUpload: (bytes: number) => void,
): Promise<void> {
  if (data == null) {
    req.end()
    return
  }

  if (isNodeReadable(data) || isWebReadableStream(data)) {
    // Web ReadableStream 先转 Node Readable，统一在 Node 流体系里走 pipeline
    const source = isWebReadableStream(data) ? Readable.fromWeb(data) : data
    const counter = new Transform({
      transform(chunk: Buffer | string, _encoding, cb) {
        const buf = typeof chunk === 'string' ? Buffer.from(chunk, 'utf-8') : chunk
        reportUpload(buf.length)
        cb(null, buf)
      },
    })
    // ClientRequest 在运行时是 Writable，d.ts 没声明，这里手动 cast 一次
    await pipeline(source, counter, req as unknown as Writable)
    return
  }

  let buf: Buffer
  if (Buffer.isBuffer(data) || data instanceof Uint8Array || data instanceof ArrayBuffer)
    buf = toBuffer(data)
  else if (typeof data === 'string')
    buf = Buffer.from(data, 'utf-8')
  else if (data instanceof URLSearchParams)
    buf = Buffer.from(data.toString(), 'utf-8')
  else
    // 兜底：当作 JSON。注意 axios 的默认 transformRequest 一般已经把对象序列化过了，
    // 走到这里通常意味着调用方手动跳过了 transformRequest。
    buf = Buffer.from(JSON.stringify(data), 'utf-8')

  reportUpload(buf.length)
  req.end(buf)
}

// =====================================================================
// 主适配器
// =====================================================================

/**
 * 让 axios 走 Electron `net.request`，从而使用 Chromium 的网络协议栈。
 * - 复用系统代理 / wpad / pac、HTTPS 隧道、Cookie 会话等 Chromium 能力
 * - 流式上传：传入 Node `Readable` 或 Web `ReadableStream` 作为 `data`
 * - 流式下载：`responseType: 'stream'` 时 `response.data` 为 Node `Readable`
 * - 完整支持 `onUploadProgress` / `onDownloadProgress` / `signal` / `timeout`
 */
export async function electronAdapter(
  config: InternalAxiosRequestConfig,
): Promise<AxiosResponse> {
  // ----- URL / Headers / Auth 准备阶段 ---------------------------------
  const method = (config.method ?? 'get').toUpperCase()
  const fullURL = appendParams(
    buildFullPath(config.baseURL, config.url ?? ''),
    config.params,
    config.paramsSerializer,
  )

  const requestHeaders = AxiosHeaders.from(config.headers)
  if (config.auth) {
    // axios 的 basic auth 由适配器自己拼，标准库不会替我们做
    const token = Buffer.from(
      `${config.auth.username ?? ''}:${config.auth.password ?? ''}`,
      'utf-8',
    ).toString('base64')
    requestHeaders.set('Authorization', `Basic ${token}`)
  }

  // 创建 ClientRequest。`useSessionCookies` 大致等价于 fetch 的 credentials: 'include'，
  // 让请求带上 default session 的 cookie，这是 axios `withCredentials` 在 Electron 主进程的最佳映射。
  let req: ElectronClientRequest
  try {
    req = net.request({
      method,
      url: fullURL,
      useSessionCookies: config.withCredentials !== false,
    })
  }
  catch (err) {
    throw new AxiosError(
      err instanceof Error ? err.message : 'Failed to create request',
      AxiosError.ERR_BAD_REQUEST,
      config,
    )
  }

  // ----- Content-Length / chunked 编码决策 ------------------------------
  // 已知长度（Buffer / string / 用户显式给的 header）就用 Content-Length，
  // 否则在流式上传场景下启用 chunked transfer encoding。
  const data = config.data
  const isStream = isNodeReadable(data) || isWebReadableStream(data)

  let knownLength: number | undefined
  if (Buffer.isBuffer(data) || data instanceof Uint8Array) {
    knownLength = data.byteLength
  }
  else if (typeof data === 'string') {
    knownLength = Buffer.byteLength(data, 'utf-8')
  }
  else {
    const headerLen = requestHeaders.get('Content-Length')
    if (headerLen != null) {
      const parsed = Number(headerLen)
      if (!Number.isNaN(parsed))
        knownLength = parsed
    }
  }

  if (isStream && knownLength === undefined) {
    req.chunkedEncoding = true
    // chunked 与 Content-Length 互斥，删除避免发送非法组合
    requestHeaders.delete('Content-Length')
  }

  // 写入 headers。axios 1.15+ 的 AxiosHeaders 实现了 Symbol.iterator，
  // 等价于 `Object.entries(toJSON())`，会自动过滤 null/false。
  for (const [key, value] of requestHeaders) {
    if (value == null)
      continue
    try {
      req.setHeader(key, Array.isArray(value) ? value.join(', ') : String(value))
    }
    catch {
      // 部分头部（Host、Content-Length、Transfer-Encoding 等）由 Chromium 内部管理，
      // 应用层无权覆盖，setHeader 会抛错——这里静默跳过即可。
    }
  }

  const reportUpload = makeProgressReporter(config.onUploadProgress, knownLength, true)

  // ----- 取消编排 -------------------------------------------------------
  // 用一个 AbortController 把三种取消源汇聚到同一个 signal 上：
  //   1) 用户传入的 config.signal
  //   2) config.timeout 触发的超时
  //   3) 上传管道自身的错误（pipeUpload 在 .catch 里调 abort）
  // 这样下游事件处理只需要看一个 signal.reason 就能拿到合适的 axios 错误对象。
  const abortCtrl = new AbortController()
  // axios 类型用的是 GenericAbortSignal（仅有 aborted），实际运行时一定是
  // 标准 AbortSignal（用户构造来源于 AbortController 或 AbortSignal.timeout 等）。
  const userSignal = config.signal as (GenericAbortSignal & { reason?: unknown }) | undefined

  /**
   * 把用户 signal 的 reason 包成 axios 风格的 CanceledError，
   * 同时保留用户主动 throw 的 Error 实例不变，方便业务自定义取消语义。
   */
  const propagateUserAbort = () => {
    const reason = userSignal?.reason
    abortCtrl.abort(reason instanceof Error
      ? reason
      : new CanceledError(
          typeof reason === 'string' ? reason : 'canceled',
          undefined,
          config,
          req,
        ))
  }

  let timeoutId: ReturnType<typeof setTimeout> | undefined
  if (config.timeout && config.timeout > 0) {
    timeoutId = setTimeout(() => {
      abortCtrl.abort(new AxiosError(
        config.timeoutErrorMessage ?? `timeout of ${config.timeout}ms exceeded`,
        AxiosError.ECONNABORTED,
        config,
        req,
      ))
    }, config.timeout)
  }

  // 任何取消源触发后，统一 abort 底层 ClientRequest
  abortCtrl.signal.addEventListener('abort', () => {
    try {
      req.abort()
    }
    catch {
      // 请求未启动或已结束时 abort 会抛错，无需关心
    }
  }, { once: true })

  if (userSignal) {
    if (userSignal.aborted) {
      // 进入函数前就已经取消了——立即触发，下面的 try 块会马上抛出
      propagateUserAbort()
    }
    else {
      userSignal.addEventListener?.('abort', propagateUserAbort, { once: true })
    }
  }

  try {
    if (abortCtrl.signal.aborted)
      throw toError(abortCtrl.signal.reason)

    // ----- 等待响应 -----------------------------------------------------
    // ClientRequest 的事件接口需要一个手动 Promise 桥接。这里用 Promise.withResolvers
    // 而不是 `new Promise(...)`，是为了让 resolve/reject 的注册和事件监听相邻可读。
    //
    // 'error' 用 `on` 而非 `once`：response 收到之后 req 仍可能再 emit 'error'（连接被
    // 重置等），这时若用 once 早已被消费并自动 remove，无监听器的 'error' 事件会被
    // EventEmitter 升级为 uncaughtException 把进程拉崩。常驻监听 + 让它随 req 一起 GC
    // 才安全；多次触发的副作用只是重复 reject 同一个已 settle 的 promise（no-op）。
    const responseDeferred = Promise.withResolvers<ElectronIncomingMessage>()
    const onResponse = (res: ElectronIncomingMessage) => responseDeferred.resolve(res)
    const onReqError = (err: Error) => responseDeferred.reject(
      new AxiosError(err.message, AxiosError.ERR_NETWORK, config, req),
    )
    /**
     * req.abort() 会触发 'abort' 事件而非 'error'，必须单独处理，
     * 否则等待 response 的 await 会永远挂起。
     */
    const onReqAbort = () => responseDeferred.reject(
      abortCtrl.signal.aborted
        ? toError(abortCtrl.signal.reason)
        : new CanceledError('canceled', undefined, config, req),
    )
    req.once('response', onResponse)
    req.on('error', onReqError)
    req.once('abort', onReqAbort)

    // 上传与等待响应并行：
    //   - 服务器可能在请求体没传完时就开始返回（chunked 响应或 100-continue 失败）
    //   - 不阻塞当前 await，让 response/error 事件能更早被处理
    //   - 上传链路上的错误反馈由 abortCtrl 统一汇聚，避免双重 reject
    pipeUpload(req, data, reportUpload).catch((err: unknown) => {
      if (abortCtrl.signal.aborted)
        return
      const error = err instanceof AxiosError
        ? err
        : new AxiosError(
            err instanceof Error ? err.message : 'Upload failed',
            undefined,
            config,
            req,
          )
      abortCtrl.abort(error)
    })

    const response = await responseDeferred.promise

    // ----- 响应处理阶段 -------------------------------------------------
    // IncomingMessage 在运行时是 Node Readable，且原生异步可迭代，但 Electron .d.ts 没暴露
    const responseStream = response as unknown as Readable & AsyncIterable<Buffer>

    const status: number = response.statusCode
    const statusText: string = response.statusMessage ?? ''
    const responseHeaders = normalizeResponseHeaders(response.headers)
    const totalLen = Number(responseHeaders['content-length']) || undefined
    const reportDownload = makeProgressReporter(config.onDownloadProgress, totalLen, false)
    const validateStatus = config.validateStatus ?? ((s: number) => s >= 200 && s < 300)

    const buildResponse = (bodyData: unknown): AxiosResponse => ({
      data: bodyData,
      status,
      statusText,
      headers: responseHeaders,
      config,
      request: req,
    })

    /**
     * 用 validateStatus 判定是否抛 AxiosError，与默认 http/xhr 适配器行为一致。
     * `cleanup` 用于在 4xx/5xx 抛错前释放底层流资源——流式下载场景下，
     * 如果不主动 destroy，IncomingMessage 会卡在 Chromium 那边等消费者，造成 socket 泄漏。
     */
    const ensureValid = (axiosResponse: AxiosResponse, cleanup?: () => void) => {
      if (validateStatus(status))
        return axiosResponse
      cleanup?.()
      throw new AxiosError(
        `Request failed with status code ${status}`,
        status >= 500 ? AxiosError.ERR_BAD_RESPONSE : AxiosError.ERR_BAD_REQUEST,
        config,
        req,
        axiosResponse,
      )
    }

    // 流式下载：IncomingMessage 本身就是 Node Readable，直接交给调用方消费。
    // 注意：调用方需要自己 pipe 或 for-await，否则数据会一直缓冲在内存里。
    //
    // 不能直接对 IncomingMessage 挂 `'data'` 监听做进度计数——那会把流切到 flowing 模式
    // 立刻开始吐数据，而调用方常常会在 `await request(...)` 之后还有 `await mkdir`
    // 之类的异步动作（多个 macrotask）才接上 `pipe(writer)`，开头那段 chunk 就被
    // 静默丢弃了，写到磁盘上的就是头被截断的内容。
    //
    // 解法：用一个透传的 Transform 兜底——`IncomingMessage.pipe(counter)` 时数据
    // 预缓冲在 counter 的内部 buffer 里（满了自然背压让 IncomingMessage 暂停），
    // 等调用方 `counter.pipe(writer)` 一接上就从头流出，一字节不丢。
    if (config.responseType === 'stream') {
      if (!config.onDownloadProgress) {
        return ensureValid(buildResponse(responseStream), () => responseStream.destroy())
      }

      const counter = new Transform({
        transform(chunk: Buffer, _encoding, cb) {
          reportDownload(chunk.length)
          cb(null, chunk)
        },
      })
      // 必须先给 counter 挂一个永久的 'error' 兜底：调用方在收到 response
      // 之后还可能有多个 await（mkdir / rm 等）才接管 counter，期间如果上游
      // 网络断了 `counter.destroy(err)` 就会在 nextTick emit 'error' 给一个
      // 没监听器的 EventEmitter，整个进程会被 unhandled error 拉崩。
      // 这个监听器是 noop——真正的错误处理仍由调用方在 pipe(writer) 时挂的
      // 'error' 监听器完成（多个 listener 都会收到事件）。
      counter.on('error', () => {})
      responseStream.on('error', err => counter.destroy(err))
      responseStream.pipe(counter)
      return ensureValid(
        buildResponse(counter),
        () => {
          responseStream.destroy()
          counter.destroy()
        },
      )
    }

    // 缓冲下载：用 async iterator 一把消费整个响应体。
    const chunks: Buffer[] = []
    try {
      for await (const chunk of responseStream) {
        chunks.push(chunk)
        reportDownload(chunk.length)
      }
    }
    catch (err) {
      // for-await 抛错通常是因为 req.abort()（被取消）或网络异常。
      // for-await 内部已经会 destroy stream，这里无需再处理。
      // 取消优先：把 abortCtrl 上携带的取消原因抛出去。
      if (abortCtrl.signal.aborted)
        throw toError(abortCtrl.signal.reason)
      throw new AxiosError(
        err instanceof Error ? err.message : 'Response error',
        undefined,
        config,
        req,
      )
    }

    // for-await 自然结束也可能是因为 req 被 abort——Node 会把流当成正常 close 处理，
    // 这种情况下 chunks 是不完整的，必须再校验一次取消状态。
    if (abortCtrl.signal.aborted) {
      responseStream.destroy()
      throw toError(abortCtrl.signal.reason)
    }

    const buffer = Buffer.concat(chunks)
    let parsed: unknown
    try {
      parsed = transformResponseData(buffer, config.responseType)
    }
    catch {
      // JSON 解析失败时退化成原文，让上层看到原始内容方便定位问题
      parsed = buffer.toString('utf-8')
    }

    return ensureValid(buildResponse(parsed))
  }
  finally {
    // 不论成功失败都要清理：
    //   1) 超时定时器：避免泄漏 + 误触发
    //   2) 用户 signal 的监听器：避免请求结束后用户再次触发取消时空转
    // 注意：req 上的 onReqError / onReqAbort / onResponse 监听器不在这里 remove。
    //   - onResponse / onReqAbort 是 once，触发即清；未触发则随 req 一起 GC
    //   - onReqError 是常驻 'on'，故意保留——即便 response 已收到，req 后续若再
    //     emit 'error'（如连接被重置）也有监听器兜底，避免没监听器导致 process 崩。
    //     responseDeferred 此时已 settle，再次 reject 是 no-op，没有副作用。
    if (timeoutId)
      clearTimeout(timeoutId)
    userSignal?.removeEventListener?.('abort', propagateUserAbort)
  }
}
