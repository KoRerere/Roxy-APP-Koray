import fs from 'node:fs'
import fsPromises from 'node:fs/promises'
import path from 'node:path'

export interface CreateSandboxFsOptions {
  outputDir: string
  readAllowlist?: string[]
  onWrite?: (filePath: string) => void
  /** Reserved for the future strong permission policy. */
  authorizePath?: (filePath: string, access: 'read' | 'write') => void
}

type AnyFunction = (...args: any[]) => any

const WRITE_FIRST_ARG = new Set([
  'appendFile',
  'chmod',
  'chown',
  'createWriteStream',
  'lchmod',
  'lchown',
  'lutimes',
  'mkdir',
  'mkdtemp',
  'open',
  'rm',
  'rmdir',
  'truncate',
  'unlink',
  'utimes',
  'writeFile',
])

const READ_FIRST_ARG = new Set([
  'access',
  'createReadStream',
  'exists',
  'existsSync',
  'lstat',
  'opendir',
  'readFile',
  'readdir',
  'readlink',
  'realpath',
  'stat',
  'statfs',
  'watch',
  'watchFile',
])

const TWO_PATH_OPERATIONS: Record<string, ['read' | 'write', 'read' | 'write']> = {
  copyFile: ['read', 'write'],
  cp: ['read', 'write'],
  link: ['read', 'write'],
  rename: ['write', 'write'],
  symlink: ['read', 'write'],
}

function resolvePathLike(outputDir: string, value: unknown): unknown {
  if (typeof value !== 'string') {
    return value
  }
  return path.isAbsolute(value) ? path.normalize(value) : path.resolve(outputDir, value)
}

function createModuleProxy<T extends object>(source: T, opts: CreateSandboxFsOptions): T {
  const outputDir = path.resolve(opts.outputDir)

  const check = (value: unknown, access: 'read' | 'write'): unknown => {
    const resolved = resolvePathLike(outputDir, value)
    if (typeof resolved === 'string') {
      // TODO(sandbox-permissions): enforce readAllowlist, canonical realpath and symlink boundaries here.
      opts.authorizePath?.(resolved, access)
      if (access === 'write') {
        opts.onWrite?.(resolved)
      }
    }
    return resolved
  }

  return new Proxy(source, {
    get(target, prop, receiver) {
      if (prop === 'default') {
        return receiver
      }
      if (prop === 'promises' && target === fs) {
        return createModuleProxy(fsPromises, opts)
      }

      const value = Reflect.get(target, prop, receiver)
      if (typeof prop !== 'string' || typeof value !== 'function') {
        return value
      }

      const twoPath = TWO_PATH_OPERATIONS[prop]
      if (twoPath) {
        return ((...args: any[]) => {
          args[0] = check(args[0], twoPath[0])
          args[1] = check(args[1], twoPath[1])
          return (value as AnyFunction).apply(target, args)
        })
      }

      if (WRITE_FIRST_ARG.has(prop)) {
        return ((...args: any[]) => {
          args[0] = check(args[0], 'write')
          return (value as AnyFunction).apply(target, args)
        })
      }

      if (READ_FIRST_ARG.has(prop)) {
        return ((...args: any[]) => {
          args[0] = check(args[0], 'read')
          return (value as AnyFunction).apply(target, args)
        })
      }

      return (value as AnyFunction).bind(target)
    },
    ownKeys(target) {
      return Array.from(new Set([...Reflect.ownKeys(target), 'default', ...(target === fs ? ['promises'] : [])]))
    },
    getOwnPropertyDescriptor(target, prop) {
      if (prop === 'default' || (prop === 'promises' && target === fs)) {
        return { configurable: true, enumerable: true }
      }
      return Reflect.getOwnPropertyDescriptor(target, prop)
    },
  })
}

export function createSandboxFsModules(opts: CreateSandboxFsOptions): {
  fs: Record<string, unknown>
  promises: Record<string, unknown>
} {
  const fsModule = createModuleProxy(fs, opts)
  const promisesModule = createModuleProxy(fsPromises, opts)
  return {
    fs: fsModule as unknown as Record<string, unknown>,
    promises: promisesModule as unknown as Record<string, unknown>,
  }
}
