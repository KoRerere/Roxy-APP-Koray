// ============================================================================
// @roxybrowser/sandbox — 脚本可用能力的完整接口定义（type-only）
// ============================================================================
//
// 这是写自动化脚本时能 import 的全部 sandbox 能力。**建议优先使用这些 package 提供的能力，您的需求超出了 package 提供的范围，那么就让agent帮您实现**
//
// 用法：
//   import { defineMetadata, defineParams } from '@roxybrowser/sandbox'  // 顶层自描述宏
//   import { sleep, pick }        from '@roxybrowser/sandbox/utils'
//   import { createHuman }        from '@roxybrowser/sandbox/human'
//   import { parse2FA, totp }     from '@roxybrowser/sandbox/2fa'
//   import { ask, json }          from '@roxybrowser/sandbox/llm'
//   import { Table }              from '@roxybrowser/sandbox/table'
//   import { KV }                 from '@roxybrowser/sandbox/kv'
//   import { getPageHtml, capturePageSnapshot } from '@roxybrowser/sandbox/debug'
//   import { writeFile }          from 'node:fs/promises'
//
// 分层（决定“调用它要付出什么”）：
//   • macro — 根 @roxybrowser/sandbox   顶层自描述宏，声明元信息/入参（无副作用）。
//   • pure  — /utils /human /2fa      无网络、无密钥、免费、确定性。随意用。
//   • host  — /llm /table /kv /debug   经宿主执行：可能慢/计费（llm）、落盘（table/kv/debug）。
//
// 关于 fs：运行时注入原生 `fs` / `node:fs` / `fs/promises` / `node:fs/promises`，
// 方法不做重写。工作目录 `workdir/{slug}` 默认可读写；外部读取由同名
// `.permissions.json` 的 `fs.read` 通过 Node permission flags 放行，外部写入不开放。
// `/table` 与 `/kv` 仍是结构化持久化的首选；`/debug` 只在 debug 模式时写入。
// ============================================================================

// ─────────────────────────────────────────────────────────────────────────────
// 根 @roxybrowser/sandbox —— 脚本自描述宏（顶层调用，入参须为静态字面量）
declare module '@roxybrowser/sandbox' {
  /** 脚本元信息支持的语言；多语言对象必须同时包含三种语言。 */
  export type ScriptMetadataLanguage = 'zh' | 'us' | 'ru'
  /** 脚本展示名：单语言字符串或完整的多语言映射。 */
  export type LocalizedScriptName
    = string | Record<ScriptMetadataLanguage, string>
  /** 脚本描述：字符串、Markdown 行数组或完整的多语言映射。 */
  export type LocalizedScriptDescription
    = string
      | string[]
      | Record<ScriptMetadataLanguage, string | string[]>
  /** 脚本元信息。 */
  export interface ScriptMetadata {
    /** 展示名（人类可读，可含中文/空格，不支持数组）。 */
    name: LocalizedScriptName
    /** 运行工作目录名；有值时 cwd 为 workdir/{slug}，否则回退脚本文件名（无扩展名）。 */
    slug?: string
    /** 脚本用途描述；数组用于分段编写 Markdown。 */
    description?: LocalizedScriptDescription
    /** 语义化版本，如 '1.0.0'。 */
    version?: string
    /** 运行时默认浏览器分身 dirId（可选）。 */
    defaultDirId?: string
    [key: string]: unknown
  }
  /**
   * 入参 JSON Schema（描述 main(options) 的 options 形状，须 type:'object'）。
   * 用户明确要求多语言展示时，properties 中的 description 可使用
   * LocalizedScriptDescription 的多语言形状；默认仍使用普通字符串。
   * ParamsSchema 保持宽松定义，不在 TypeScript 中约束每个 JSON Schema 节点。
   */
  export interface OptionsSchema {
    type: 'object'
    properties?: Record<string, unknown>
    required?: string[]
    additionalProperties?: boolean
    [key: string]: unknown
  }
  /** 顶层声明脚本元信息（identity 宏，原样返回）。 */
  export function defineMetadata(metadata: ScriptMetadata): ScriptMetadata
  /** 顶层声明入参 JSON Schema（identity 宏，原样返回）。 */
  export function defineParams(schema: OptionsSchema): OptionsSchema
}

// ─────────────────────────────────────────────────────────────────────────────
declare module '@roxybrowser/sandbox/utils' {
  /** 随机等待 [min, max] 毫秒（含端点）。相比较于 waitForTimeout，它更加拟人化，拥有随机性。 */
  export function sleep(min: number, max: number): Promise<void>

  /** 返回 [min, max] 内的随机整数（含端点）。用于滚动距离、索引、次数。 */
  export function randomBetween(min: number, max: number): number

  /** 从数组中等概率随机取一个元素。 */
  export function pick<T>(arr: readonly T[]): T

  /** 以概率 probability ∈ [0,1] 返回 true。可用于可选动作（如 70% 概率点赞）。 */
  export function maybe(probability: number): boolean

  /** 把数组按固定长度切分成若干块。用于分页 / 分批。 */
  export function chunk<T>(arr: readonly T[], size: number): T[][]

  export interface RetryOptions {
    /** 最大尝试次数（含首次）。默认 3。 */
    attempts?: number
    /** 首次重试前的基础延迟（ms）。默认 500。 */
    baseDelay?: number
    /** 退避因子：第 n 次重试延迟 = baseDelay * factor^(n-1)。默认 2（指数退避）。 */
    factor?: number
    /** 每次失败后的回调（可用于日志）。 */
    onRetry?: (error: unknown, attempt: number) => void
  }

  /**
   * 带指数退避的重试。适合偶发网络/渲染抖动的操作（如 waitForSelector、点击）。
   * 所有尝试都失败时抛出最后一次的错误。
   */
  export function retry<T>(fn: () => Promise<T>, opts?: RetryOptions): Promise<T>
}

// ─────────────────────────────────────────────────────────────────────────────
declare module '@roxybrowser/sandbox/human' {
  import type { Locator, Page } from 'playwright'

  export type HumanRange = readonly [min: number, max: number]
  export type HumanTypeMode = 'replace' | 'append'
  export type HumanScrollAxis = 'horizontal' | 'vertical'
  export type HumanMotionCurveName = 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out'
  export type HumanMotionCurveFunction = (progress: number) => number
  export type HumanMotionCurve = HumanMotionCurveName | HumanMotionCurveFunction
  export type HumanScrollCurveName = HumanMotionCurveName
  export type HumanScrollCurveFunction = HumanMotionCurveFunction
  export type HumanScrollCurve = HumanMotionCurve

  export interface HumanPoint {
    x: number
    y: number
  }

  export interface CreateHumanOptions {
    /** Playwright 的合成鼠标默认从视口原点开始。 */
    initialPointer?: HumanPoint
  }

  export type HumanPointerPathFunction = (progress: number, start: HumanPoint, end: HumanPoint) => HumanPoint

  export interface HumanBezierPath {
    type: 'bezier'
    /** 相对直线路径的有符号垂直偏移量（px）。 */
    curvature: number
  }

  export type HumanPointerPath = 'linear' | HumanBezierPath | HumanPointerPathFunction

  export interface HumanPointerMotionOptions {
    duration: number
    curve: HumanMotionCurve
    path: HumanPointerPath
  }

  export interface HumanMoveOptions {
    target: Locator | HumanPoint
    /** 相对 Locator 左上角的位置；默认精确中心。 */
    position?: HumanPoint
    /** 移动前是否显式滚动 Locator 到可见区域；默认 false。 */
    ensureVisible?: boolean
    motion: HumanPointerMotionOptions
  }

  export interface HumanHoverOptions extends HumanMoveOptions {
    dwellDuration: number
  }

  export interface HumanClickOptions extends HumanMoveOptions {
    button?: 'left' | 'middle' | 'right'
    settleDuration: number
    holdDuration: number
  }

  export type HumanTypeFocusOptions = Omit<HumanClickOptions, 'target'>

  export interface HumanTypeOptions {
    target: Locator
    text: string
    mode: HumanTypeMode
    /** 分配给全部字符输入的总时间，不含聚焦和清空。 */
    duration: number
    /** 输入不可逆，因此曲线必须单调。 */
    curve: HumanMotionCurve
    /** 显式点击聚焦参数；目标已聚焦时传 false。 */
    focus: HumanTypeFocusOptions | false
  }

  export interface HumanPressOptions {
    key: string
    holdDuration: number
  }

  export interface HumanScrollOptions {
    /** 相对滚轮位移（px）；正数向右/向下，负数向左/向上。 */
    distance: number
    axis: HumanScrollAxis
    /** 完成滚动所需的总时间（ms）。 */
    duration: number
    /** 将 `[0, 1]` 时间映射为累计位移；必须满足 `curve(0)=0`、`curve(1)=1`。 */
    curve: HumanMotionCurve
  }

  export interface HumanPauseOptions {
    duration: number
  }

  export const motionCurves: {
    linear: HumanMotionCurveFunction
    easeInCubic: HumanMotionCurveFunction
    easeOutCubic: HumanMotionCurveFunction
    easeInOutCubic: HumanMotionCurveFunction
  }
  export const scrollCurves: typeof motionCurves

  export interface Human {
    move(options: HumanMoveOptions): Promise<void>
    hover(options: HumanHoverOptions): Promise<void>
    click(options: HumanClickOptions): Promise<void>
    type(options: HumanTypeOptions): Promise<void>
    press(options: HumanPressOptions): Promise<void>
    scroll(options: HumanScrollOptions): Promise<void>
    pause(options: HumanPauseOptions): Promise<void>
  }

  /** 创建绑定到单个 Page、共享鼠标位置状态的显式交互操作者。 */
  export function createHuman(page: Page, options?: CreateHumanOptions): Human

  export interface LegacyHumanScrollOptions {
    distance: number
    direction?: 'down' | 'up'
    stepMin?: number
    stepMax?: number
    delayMin?: number
    delayMax?: number
    backstepChance?: number
    backstepRatio?: number
  }

  /** @deprecated 使用 `createHuman(page).scroll(options)`。 */
  export function humanScroll(page: Page, options: LegacyHumanScrollOptions): Promise<void>

  export interface LegacyHumanTypeOptions {
    minDelay?: number
    maxDelay?: number
  }

  /** @deprecated 使用 `createHuman(page).type(options)`。 */
  export function humanType(page: Page, text: string, options?: LegacyHumanTypeOptions): Promise<void>
}

// ─────────────────────────────────────────────────────────────────────────────
declare module '@roxybrowser/sandbox/2fa' {
  export type TotpAlgorithm = 'SHA1' | 'SHA256' | 'SHA512'

  export interface TwoFactorOptions {
    /** 指定计算时间。默认当前时间；传 number 时单位为毫秒时间戳。 */
    time?: number | Date
    /** TOTP 周期秒数。默认 30；otpauth URI 中的 period 会覆盖默认值。 */
    period?: number
    /** 验证码位数。默认 6；otpauth URI 中的 digits 会覆盖默认值。 */
    digits?: number
    /** HMAC 算法。默认 SHA1；otpauth URI 中的 algorithm 会覆盖默认值。 */
    algorithm?: TotpAlgorithm
  }

  export interface TwoFactorCode {
    /** 当前 2FA 验证码，保留前导 0。 */
    code: string
    /** 距离当前验证码过期还剩多少秒。 */
    secondsRemaining: number
    /** 当前验证码过期时间，毫秒时间戳。 */
    expiresAt: number
    period: number
    digits: number
    algorithm: TotpAlgorithm
    issuer?: string
    account?: string
  }

  /** 解析 base32 2FA secret，返回当前 TOTP 验证码和过期信息。 */
  export function parse2FA(input: string, options?: TwoFactorOptions): TwoFactorCode

  /** 只返回当前验证码的便捷函数。 */
  export function totp(input: string, options?: TwoFactorOptions): string
}

// ─────────────────────────────────────────────────────────────────────────────
declare module '@roxybrowser/sandbox/llm' {
  /** 单次调用可带的参数。 */
  export interface LlmCallOptions {
    /** 采样温度（0~2）。结构化任务建议低温度。 */
    temperature?: number
    /** 最大生成 token 数。 */
    maxTokens?: number
    /** 中止信号——脚本被 abort 时应一并取消本次调用。 */
    signal?: AbortSignal
  }

  /** 文本：给定 prompt，返回模型生成的纯文本。 */
  export function ask(prompt: string, opts?: LlmCallOptions): Promise<string>

  /**
   * 结构化：给定 prompt 与完整 JSON Schema，返回符合 schema 的对象。
   * 需要结构化输出（分类、抽取、判断…）时用它，schema 描述期望结构。
   * @example
   * const { price } = await json<{ price: number }>(prompt, {
   *   type: 'object', properties: { price: { type: 'number' } }, required: ['price'],
   * })
   */
  export function json<T = unknown>(prompt: string, schema: object, opts?: LlmCallOptions): Promise<T>
}

// ─────────────────────────────────────────────────────────────────────────────
declare module '@roxybrowser/sandbox/table' {
  /** 一条记录（一行）：扁平的键值对。 */
  export type TableRecord = Record<string, unknown>

  /**
   * 表格持久化（采用 CSV 的格式，持久化到本地）。常用于记录脚本的一些采集信息。
   *
   * `Table` 是一个 class；一个 `new Table(name)` 实例就是一个持久化数据桶，
   * 
   * `new Table(name)` 会异步载入内存（文件缺失则创建）；所有方法都返回 Promise，需 `await`。
   *
   * @example
   * const rec = new Table('yanghao-record')
   * await rec.append({ account: 'a1', action: 'like', at: Date.now() })
   * const rows = await rec.all<{ account: string, action: string }>()
   * const one  = await rec.find(r => r.account === 'a1')
   */
  export class Table {
    /** @param name 表逻辑名（对应存放目录下的 `<name>.csv`）。 */
    constructor(name: string)
    /** 表逻辑名。 */
    get name(): string
    /** 首次写入以记录的键作为表头；后续按已有表头对齐（缺失列留空）。 */
    append(record: TableRecord | TableRecord[]): Promise<void>
    /** 读取全部行。 */
    all<T extends TableRecord = TableRecord>(): Promise<T[]>
    /** 在内存中查找第一条满足条件的行；无匹配返回 undefined。 */
    find<T extends TableRecord = TableRecord>(predicate: (row: T, index: number) => boolean): Promise<T | undefined>
    /** 清空表。 */
    clear(): Promise<void>
  }
}

// ─────────────────────────────────────────────────────────────────────────────
declare module '@roxybrowser/sandbox/kv' {
  /**
   * KV class 键值持久化（采用 JSON 的格式，持久化到本地）。
   *
   * `new KV(name)` 创建一个数据桶；所有方法都返回 Promise，需 `await`。
   *
   * @example
   * const state = new KV('yanghao-state')
   * await state.set('a1:lastRun', Date.now())
   * const last = await state.get<number>('a1:lastRun')
   */
  export class KV {
    /** @param name KV 命名空间逻辑名（对应存放目录下的 `<name>.kv.json`）。 */
    constructor(name: string)
    /** KV 命名空间逻辑名。 */
    get name(): string
    /** 读取一个键；不存在返回 undefined。 */
    get<T = unknown>(key: string): Promise<T | undefined>
    /** 写入一个键（值需可 JSON 序列化）。 */
    set(key: string, value: unknown): Promise<void>
    /** 键是否存在。 */
    has(key: string): Promise<boolean>
    /** 删除一个键；返回删除前是否存在。 */
    delete(key: string): Promise<boolean>
    /** 所有键。 */
    keys(): Promise<string[]>
    /** 整个键值快照。 */
    all<T extends Record<string, unknown> = Record<string, unknown>>(): Promise<T>
    /** 清空整个命名空间。 */
    clear(): Promise<void>
  }
}

// ─────────────────────────────────────────────────────────────────────────────
declare module '@roxybrowser/sandbox/debug' {
  import type { Page } from 'playwright'

  export type PageHtmlRoot = 'body' | { selector: string }
  export type FormValueMode = 'mask' | 'include' | 'omit'

  export interface PageHtmlOptions {
    /** 默认抓取完整 body；也可限制到一个 CSS selector。 */
    root?: PageHtmlRoot
    /** 从克隆 DOM 中删除的 CSS selectors；默认 `['script', 'style']`。 */
    remove?: string[]
    /** 是否删除 HTML comments；默认 true。 */
    stripComments?: boolean
    /** 实时表单值处理方式；默认 mask。 */
    formValues?: FormValueMode
    /** 最大 UTF-8 字节数；默认 5 MiB，硬上限 50 MiB。 */
    maxBytes?: number
  }

  export interface PageHtmlStats {
    bytes: number
    removedNodes: Record<string, number>
    removedComments: number
  }

  export interface PageHtmlResult {
    html: string
    url: string
    title: string
    capturedAt: string
    stats: PageHtmlStats
  }

  export interface CapturePageSnapshotOptions extends PageHtmlOptions {
    label: string
  }

  export type CapturePageSnapshotResult =
    | { status: 'disabled' }
    | {
      status: 'captured'
      label: string
      htmlPath: string
      url: string
      title: string
      capturedAt: string
      stats: PageHtmlStats
    }

  /** 获取当前实时 body DOM；默认删除 script/style 和 comments、遮蔽表单值、保留 SVG。 */
  export function getPageHtml(page: Page, options?: PageHtmlOptions): Promise<PageHtmlResult>

  /** debug profile 下保存清洗后的 body HTML，并通过 console.debug 输出绝对路径；release 返回 disabled。 */
  export function capturePageSnapshot(
    page: Page,
    options: CapturePageSnapshotOptions,
  ): Promise<CapturePageSnapshotResult>
}
