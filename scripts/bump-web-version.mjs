#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const ENV_KEY = 'VITE_VERSION'

function normalizeMode(mode) {
  if (mode === 'production' || mode === 'prod') {
    return 'production'
  }

  return 'development'
}

function getWebEnvPath(mode) {
  return resolve(ROOT_DIR, 'apps', 'web', `.env.${mode}`)
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function getEnvRawValue(content, key) {
  const pattern = new RegExp(`^\\s*(?:export\\s+)?${escapeRegExp(key)}\\s*=\\s*(.*)$`, 'm')
  const match = content.match(pattern)
  return match?.[1]?.trim()
}

function setEnvRawValue(content, key, rawValue) {
  const lineEnding = content.includes('\r\n') ? '\r\n' : '\n'
  const pattern = new RegExp(`^(\\s*(?:export\\s+)?${escapeRegExp(key)}\\s*=\\s*).*$`, 'm')

  if (pattern.test(content)) {
    return content.replace(pattern, `$1${rawValue}`)
  }

  const suffix = content.endsWith('\n') || content.endsWith('\r\n') ? '' : lineEnding
  return `${content}${suffix}${key}=${rawValue}${lineEnding}`
}

/** 只加补丁号：2.15.21 => 2.15.22。部署用的是构建时写死的版本，必须在 vite build 之前改 env。 */
export function bumpPatchVersion(rawValue) {
  const trimmed = rawValue.trim()
  const quoted = trimmed.match(/^(['"])(.*)\1$/)
  const version = quoted ? quoted[2] : trimmed
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)$/)

  if (!match) {
    throw new Error(`${ENV_KEY} 不是 x.y.z 版本号：${rawValue}`)
  }

  const next = `${match[1]}.${match[2]}.${Number(match[3]) + 1}`
  return quoted ? `${quoted[1]}${next}${quoted[1]}` : next
}

export async function bumpWebVersion(mode = normalizeMode(process.env.MODE || process.env.NODE_ENV)) {
  const normalizedMode = normalizeMode(mode)
  const webEnvPath = getWebEnvPath(normalizedMode)
  const webEnv = await readFile(webEnvPath, 'utf-8')
  const current = getEnvRawValue(webEnv, ENV_KEY)

  if (!current) {
    throw new Error(`${webEnvPath} 缺少 ${ENV_KEY}`)
  }

  const next = bumpPatchVersion(current)
  const nextWebEnv = setEnvRawValue(webEnv, ENV_KEY, next)

  if (nextWebEnv !== webEnv) {
    await writeFile(webEnvPath, nextWebEnv, 'utf-8')
  }

  console.log(`[bump-web-version] ${webEnvPath} ${ENV_KEY}: ${current} => ${next}`)
  return next
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await bumpWebVersion(process.argv[2])
}
