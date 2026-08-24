import { describe, expect, it } from 'vitest'
import { createLogger } from '../../src/logging/logger.ts'
import type { ILogSink } from '../../src/logging/sinks.ts'

type Entry = { level: string; scope: string; msg: string; meta: Record<string, unknown> }

function captureSink(): { sink: ILogSink; entries: Entry[] } {
  const entries: Entry[] = []
  return {
    entries,
    sink: {
      write(level, scope, msg, meta) {
        entries.push({ level, scope, msg, meta })
      },
    },
  }
}

describe('createLogger', () => {
  it('routes a message to the sink with correct level, scope, msg, meta', () => {
    const { sink, entries } = captureSink()
    const log = createLogger({ scope: 'root', sinks: [sink] })
    log.info('hello', { key: 'val' })
    expect(entries).toEqual([{ level: 'info', scope: 'root', msg: 'hello', meta: { key: 'val' } }])
  })

  it('passes an empty meta object when none is supplied', () => {
    const { sink, entries } = captureSink()
    const log = createLogger({ scope: 'root', sinks: [sink] })
    log.debug('hi')
    expect(entries[0]?.meta).toEqual({})
  })

  it("child logger inherits scope as 'parent:child'", () => {
    const { sink, entries } = captureSink()
    const root = createLogger({ scope: 'root', sinks: [sink] })
    const child = root.child('sub')
    child.info('hi')
    expect(entries[0]?.scope).toBe('root:sub')
  })

  it('grandchild composes all scopes', () => {
    const { sink, entries } = captureSink()
    const root = createLogger({ scope: 'a', sinks: [sink] })
    const child = root.child('b').child('c')
    child.warn('deep')
    expect(entries[0]?.scope).toBe('a:b:c')
  })

  it('filters messages below the configured level', () => {
    const { sink, entries } = captureSink()
    const log = createLogger({ level: 'warn', scope: 'x', sinks: [sink] })
    log.trace('t')
    log.debug('d')
    log.info('i')
    log.warn('w')
    log.error('e')
    expect(entries.map((e) => e.level)).toEqual(['warn', 'error'])
  })

  it('default level allows all messages (trace)', () => {
    const { sink, entries } = captureSink()
    const log = createLogger({ scope: 'x', sinks: [sink] })
    log.trace('t')
    log.debug('d')
    log.info('i')
    log.warn('w')
    log.error('e')
    expect(entries).toHaveLength(5)
  })

  it('broadcasts to multiple sinks', () => {
    const a = captureSink()
    const b = captureSink()
    const log = createLogger({ scope: 'root', sinks: [a.sink, b.sink] })
    log.info('broadcast')
    expect(a.entries).toHaveLength(1)
    expect(b.entries).toHaveLength(1)
  })
})
