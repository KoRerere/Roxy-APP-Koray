/**
 * `@roxybrowser/sandbox` —— 脚本自描述宏（根导出）。
 *
 * 自动化脚本在顶层调用 `defineMetadata` / `defineOptions` 声明元信息与入参 JSON Schema，
 * 使脚本成为**单文件自描述**资产（文件名仍是脚本身份，无需外挂 meta.json / schema.json；
 * 可选 metadata.slug 用于指定运行资产目录）。
 *
 * 这两个函数是 **identity 宏**：运行期原样返回入参、无副作用，仅作声明标记。
 * - 创作/发布期：宿主用 `vm.compileFunction` 求值脚本顶层，捕获这两个调用的入参，
 *   提取出 metadata 与 optionsSchema（见 roxy-agent 的 `script/scriptMeta.ts`）。
 * - 运行期：脚本经 `import { defineMetadata, defineOptions } from '@roxybrowser/sandbox'`
 *   拿到本模块（sandbox linker 注入），调用无副作用。
 */

/** 脚本元信息支持的语言。 */
export type ScriptMetadataLanguage = 'zh' | 'us' | 'ru'

/** 脚本展示名：单语言字符串或完整的多语言映射。 */
export type LocalizedScriptName
  = string | Record<ScriptMetadataLanguage, string>

/** 脚本描述：字符串、Markdown 行数组或完整的多语言映射。 */
export type LocalizedScriptDescription
  = string
    | string[]
    | Record<ScriptMetadataLanguage, string | string[]>

/** 脚本元信息（`defineMetadata` 入参）。字段均为静态字面量。 */
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
 * 入参 JSON Schema（`defineOptions` 入参）。描述 `main(options)` 的 options 形状，
 * 供前端渲染入参表单、agent 构造 run_script 的 options。须为 `type: 'object'` 的静态字面量。
 */
export interface ParamsSchema {
  type: 'object'
  properties?: Record<string, unknown>
  required?: string[]
  additionalProperties?: boolean
  [key: string]: unknown
}

/** 声明脚本元信息。identity 宏——原样返回入参。 */
export function defineMetadata(metadata: ScriptMetadata): ScriptMetadata {
  return metadata
}

/** 声明脚本入参 JSON Schema。identity 宏——原样返回入参。 */
export function defineParams(schema: ParamsSchema): ParamsSchema {
  return schema
}
