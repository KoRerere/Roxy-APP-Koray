import fsPromises from 'node:fs/promises'
import { DEFAULT_FETCH_ALLOWLIST } from './defaultFetchAllowlist'

export interface ScriptPermissions {
  version: 1
  fs: { read: string[] }
  fetch: { allow: string[] }
}

function emptyPermissions(): ScriptPermissions {
  return { version: 1, fs: { read: [] }, fetch: { allow: [] } }
}

export class PermissionDeniedError extends Error {
  constructor(message: string) {
    super(`Permission denied: ${message}`)
    this.name = 'PermissionDeniedError'
  }
}

function stringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(item => typeof item === 'string' && item.trim().length > 0)
}

export function parseScriptPermissions(raw: unknown): ScriptPermissions {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Invalid script permissions: expected an object')
  }

  const input = raw as Record<string, unknown>
  const fsPolicy = input.fs && typeof input.fs === 'object' ? input.fs as Record<string, unknown> : {}
  const fetchPolicy = input.fetch && typeof input.fetch === 'object' ? input.fetch as Record<string, unknown> : {}
  const read = fsPolicy.read ?? []
  const allow = fetchPolicy.allow ?? []

  if (input.version !== 1 || !stringArray(read) || !stringArray(allow)) {
    throw new Error('Invalid script permissions: expected version 1 with string-array fs.read and fetch.allow')
  }

  return {
    version: 1,
    fs: { read: read.map(item => item.trim()) },
    fetch: { allow: allow.map(item => item.trim().toLowerCase()) },
  }
}

export async function readScriptPermissions(filePath: string): Promise<ScriptPermissions> {
  try {
    return parseScriptPermissions(JSON.parse(await fsPromises.readFile(filePath, 'utf-8')))
  }
  catch (error: any) {
    if (error?.code === 'ENOENT') {
      return emptyPermissions()
    }
    if (error instanceof SyntaxError) {
      throw new Error(`Invalid script permissions: ${error.message}`)
    }
    throw error
  }
}

function matchesManifestFetchRule(hostname: string, rule: string): boolean {
  if (rule.startsWith('*.')) {
    const suffix = rule.slice(2)
    return hostname.length > suffix.length && hostname.endsWith(`.${suffix}`)
  }
  return hostname === rule
}

function matchesDefaultFetchDomain(hostname: string, domain: string): boolean {
  return hostname === domain || hostname.endsWith(`.${domain}`)
}

export function assertFetchAllowed(input: string | URL, permissions: ScriptPermissions): URL {
  let url: URL
  try {
    url = input instanceof URL ? input : new URL(input)
  }
  catch {
    throw new PermissionDeniedError(`invalid fetch URL: ${String(input)}`)
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new PermissionDeniedError(`fetch protocol ${url.protocol}`)
  }

  const hostname = url.hostname.toLowerCase()
  const allowed = permissions.fetch.allow.some(rule => matchesManifestFetchRule(hostname, rule))
    || DEFAULT_FETCH_ALLOWLIST.some(domain => matchesDefaultFetchDomain(hostname, domain))
  if (!allowed) {
    throw new PermissionDeniedError(`fetch host ${hostname}`)
  }
  return url
}
