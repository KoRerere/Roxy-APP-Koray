import type { ParamsSchema, ScriptMetadata } from '@/modes/sandbox-api'
import { parse } from '@babel/parser'
import { stripTypeScriptTypes } from 'node:module'

/**
 * 从脚本源码静态提取顶层 `defineMetadata({...})` / `defineParams({...})`。
 *
 * 只解析 AST，不执行脚本顶层代码。这样即使脚本里有顶层 throw、I/O 或其它副作用，
 * LibraryStore.get/list 与 roxy_script_describe 的本地路径分支也只读取静态字面量参数。
 */

export interface ExtractedScriptMeta {
  metadata: ScriptMetadata
  /** 供前端渲染表单 / agent 构造 roxy_script_run 的 params。 */
  paramsSchema: ParamsSchema
}

function literalKey(node: any): string | null {
  if (!node) {
    return null
  }
  if (node.type === 'Identifier') {
    return node.name
  }
  if (node.type === 'StringLiteral' || node.type === 'NumericLiteral') {
    return String(node.value)
  }
  return null
}

function literalValue(node: any): unknown {
  switch (node?.type) {
    case 'ObjectExpression': {
      const out: Record<string, unknown> = {}
      for (const prop of node.properties) {
        if (prop.type !== 'ObjectProperty') {
          throw new Error('自描述宏只支持静态对象属性。')
        }
        const key = literalKey(prop.key)
        if (!key) {
          throw new Error('自描述宏包含不支持的属性名。')
        }
        out[key] = literalValue(prop.value)
      }
      return out
    }
    case 'ArrayExpression':
      return node.elements.map((element: any) => {
        if (!element) {
          throw new Error('自描述宏不支持稀疏数组。')
        }
        return literalValue(element)
      })
    case 'StringLiteral':
    case 'NumericLiteral':
    case 'BooleanLiteral':
      return node.value
    case 'NullLiteral':
      return null
    case 'UnaryExpression': {
      const value = literalValue(node.argument)
      if (node.operator === '-' && typeof value === 'number') {
        return -value
      }
      throw new Error('自描述宏包含不支持的一元表达式。')
    }
    default:
      throw new Error('自描述宏入参必须是静态对象字面量。')
  }
}

function parseScript(source: string): any {
  try {
    const stripped = stripTypeScriptTypes(source, { mode: 'strip' })
    return parse(stripped, {
      sourceType: 'module',
      allowReturnOutsideFunction: true,
      plugins: ['importAttributes'],
    })
  }
  catch (error) {
    throw new Error(`脚本语法解析失败：${error instanceof Error ? error.message : String(error)}`)
  }
}

function findTopLevelMacroArg(ast: any, macroName: 'defineMetadata' | 'defineParams'): any | null {
  for (const statement of ast.program.body as any[]) {
    if (statement.type !== 'ExpressionStatement') {
      continue
    }
    const expression = statement.expression
    if (expression?.type !== 'CallExpression') {
      continue
    }
    if (expression.callee?.type !== 'Identifier' || expression.callee.name !== macroName) {
      continue
    }
    return expression.arguments[0] ?? null
  }
  return null
}

function extractMacroObject(ast: any, macroName: 'defineMetadata' | 'defineParams'): Record<string, any> {
  const arg = findTopLevelMacroArg(ast, macroName)
  if (!arg) {
    throw new Error(`脚本缺少 ${macroName}({ ... }) 顶层调用。`)
  }
  const value = literalValue(arg)
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${macroName} 入参必须是静态对象字面量。`)
  }
  return value as Record<string, any>
}

function hasNonEmptyName(value: unknown): boolean {
  if (typeof value === 'string') {
    return Boolean(value.trim())
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }
  return Object.values(value).some(item => typeof item === 'string' && Boolean(item.trim()))
}

export function extractScriptMeta(source: string): ExtractedScriptMeta {
  const ast = parseScript(source)
  return extractScriptMetaFromAst(ast)
}

function extractScriptMetaFromAst(ast: any): ExtractedScriptMeta {
  const metadata = extractMacroObject(ast, 'defineMetadata') as ScriptMetadata
  const paramsSchema = extractMacroObject(ast, 'defineParams') as ParamsSchema
  if (!hasNonEmptyName(metadata.name)) {
    throw new Error('defineMetadata.name 不能为空。')
  }
  if (paramsSchema.type !== 'object') {
    throw new Error('defineParams.type 必须是 \'object\'。')
  }

  return {
    metadata,
    paramsSchema,
  }
}

function exportedName(node: any): string | null {
  if (!node) {
    return null
  }
  if (node.type === 'Identifier') {
    return node.name
  }
  if (node.type === 'StringLiteral') {
    return String(node.value)
  }
  return null
}

function hasExportedEntrypoint(ast: any): boolean {
  for (const statement of ast.program.body as any[]) {
    if (statement.type !== 'ExportNamedDeclaration') {
      continue
    }

    const declaration = statement.declaration
    if (declaration?.type === 'FunctionDeclaration' && declaration.id?.name === 'main') {
      return true
    }

    if (declaration?.type === 'VariableDeclaration') {
      for (const item of declaration.declarations) {
        if (item.id?.type === 'Identifier' && (item.id.name === 'main' || item.id.name === '__main')) {
          return true
        }
      }
    }

    for (const specifier of statement.specifiers ?? []) {
      const name = exportedName(specifier.exported)
      if (name === 'main' || name === '__main') {
        return true
      }
    }
  }
  return false
}

/** 静态解析并校验一份可执行脚本的完整自描述，不执行任何脚本代码。 */
export function extractScriptSelfDescription(source: string): ExtractedScriptMeta {
  const ast = parseScript(source)
  const extracted = extractScriptMetaFromAst(ast)

  if (!hasExportedEntrypoint(ast)) {
    throw new Error('脚本缺少导出的 main(options) 函数。')
  }
  return extracted
}
