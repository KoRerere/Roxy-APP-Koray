import assert from 'node:assert/strict'
import { describe, it } from 'vitest'
import { extractScriptSelfDescription } from './scriptMeta'

const VALID_SCRIPT = `
import { defineMetadata, defineParams } from '@roxybrowser/sandbox'

defineMetadata({
  name: { zh: '批量养号', en: 'Batch account nurturing' },
  description: '模拟自然浏览行为',
})

defineParams({
  type: 'object',
  properties: {
    keyword: { type: 'string', title: '关键词' },
    retries: { type: 'integer', default: 2 },
  },
  required: ['keyword'],
})

export async function main(options: { keyword: string }) {
  return options.keyword
}
`

describe('extractScriptSelfDescription', () => {
  it('extracts localized metadata and the complete params schema from TypeScript', () => {
    const result = extractScriptSelfDescription(VALID_SCRIPT)

    assert.deepEqual(result.metadata, {
      name: { zh: '批量养号', en: 'Batch account nurturing' },
      description: '模拟自然浏览行为',
    })
    assert.deepEqual(result.paramsSchema, {
      type: 'object',
      properties: {
        keyword: { type: 'string', title: '关键词' },
        retries: { type: 'integer', default: 2 },
      },
      required: ['keyword'],
    })
  })

  it('accepts an exported main variable in JavaScript', () => {
    const result = extractScriptSelfDescription(`
      defineMetadata({ name: 'JavaScript template' })
      defineParams({ type: 'object', properties: {} })
      export const main = async () => undefined
    `)

    assert.equal(result.metadata.name, 'JavaScript template')
  })

  it('rejects a script without a self-description macro', () => {
    assert.throws(
      () => extractScriptSelfDescription(`
        defineMetadata({ name: 'Missing params' })
        export function main() {}
      `),
      /defineParams/,
    )
  })

  it('rejects an empty script name', () => {
    assert.throws(
      () => extractScriptSelfDescription(`
        defineMetadata({ name: '   ' })
        defineParams({ type: 'object', properties: {} })
        export function main() {}
      `),
      /defineMetadata\.name/,
    )
  })

  it('requires an object params schema', () => {
    assert.throws(
      () => extractScriptSelfDescription(`
        defineMetadata({ name: 'Invalid params' })
        defineParams({ type: 'array' })
        export function main() {}
      `),
      /defineParams\.type/,
    )
  })

  it('rejects dynamic expressions without executing them', () => {
    assert.throws(
      () => extractScriptSelfDescription(`
        const dynamicName = globalThis.secret
        defineMetadata({ name: dynamicName })
        defineParams({ type: 'object', properties: {} })
        export function main() {}
      `),
      /静态对象字面量/,
    )
  })

  it('rejects a script without an exported entrypoint', () => {
    assert.throws(
      () => extractScriptSelfDescription(`
        defineMetadata({ name: 'No entrypoint' })
        defineParams({ type: 'object', properties: {} })
      `),
      /main\(options\)/,
    )
  })
})
