#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const ENV_KEY = 'VITE_APP_VERSION'

function normalizeMode(mode) {
  if (mode === 'production' || mode === 'prod') {
    return 'production'
  }

  return 'development'
}

function getEnvPath(appName, mode) {
  return resolve(ROOT_DIR, 'apps', appName, `.env.${mode}`)
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

export async function syncWebAppVersion(mode = normalizeMode(process.env.MODE || process.env.NODE_ENV)) {
  const normalizedMode = normalizeMode(mode)
  const electronEnvPath = getEnvPath('electron', normalizedMode)
  const webEnvPath = getEnvPath('web', normalizedMode)

  const electronEnv = await readFile(electronEnvPath, 'utf-8')
  const webEnv = await readFile(webEnvPath, 'utf-8')
  const electronAppVersion = getEnvRawValue(electronEnv, ENV_KEY)

  if (!electronAppVersion) {
    throw new Error(`${electronEnvPath} 缺少 ${ENV_KEY}`)
  }

  const nextWebEnv = setEnvRawValue(webEnv, ENV_KEY, electronAppVersion)

  if (nextWebEnv !== webEnv) {
    await writeFile(webEnvPath, nextWebEnv, 'utf-8')
    console.log(`[sync-web-app-version] ${webEnvPath} ${ENV_KEY}=${electronAppVersion}`)
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await syncWebAppVersion(process.argv[2])
}
