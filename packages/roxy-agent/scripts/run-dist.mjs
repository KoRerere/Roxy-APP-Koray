#!/usr/bin/env node
/**
 * 启动 webpack 产物 dist/index.mjs。
 *
 * 说明：打包后的入口不会自动加载 .env（与 src/cli.ts 不同），
 * 若直接 `node dist/index.mjs`，过程环境里没有变量时容易在启动阶段报错。
 *
 * 用法：
 *   node scripts/run-dist.mjs
 *   node scripts/run-dist.mjs --with-dev-defaults
 *   node scripts/run-dist.mjs --print-env
 *
 * 选项：
 *   --with-dev-defaults  为 CHECKPOINT_DIR / DOWNLOADS_DIR / SKILLS_DIR / START_SCRIPT 填包内默认路径（仍需 LLM_* 等）
 *   --print-env          启动前打印环境变量键与脱敏值（不含 LLM_API_KEY 等完整密钥）
 */

import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const indexMjs = path.join(root, 'dist', 'index.mjs')
const envFile = path.join(root, '.env')
const exampleFile = path.join(root, '.env.example')

/** 与 .env.example / config.ts 对齐的键（用于 --print-env） */
const ALL_ENV_KEYS = [
  'LLM_PROVIDER',
  'LLM_MODEL',
  'LLM_API_KEY',
  'LLM_BASE_URL',
  'LLM_BALANCE',
  'MAX_TURNS',
  'CONTEXT_MESSAGE_LIMIT',
  'WORKER_CONTEXT_LIMIT',
  'SYSTEM_LANGUAGE',
  'OPENAPI_SCRIPT_PATH',
  'OPENAPI_SCRIPT_SHA512',
  'ROXY_API_KEY',
  'ROXY_API_HOST',
  'PLAYWRIGHT_SCRIPT_PATH',
  'PLAYWRIGHT_SCRIPT_SHA512',
  'CHECKPOINT_DIR',
  'ROXY_SERVER_PORT',
  'ROXY_USER_ID',
  'ROXY_WORKSPACE_ID',
  'MAX_MESSAGES_BEFORE_SUMMARY',
  'KEEP_RECENT_MESSAGES',
  'SIMPLE_SYNTHESIS_CONTEXT_LIMIT',
  'SILICONFLOW_THINKING_BUDGET',
  'SITE_URL',
  'SITE_NAME',
  'DEVELOPMENT',
  'DEBUG',
  'START_SCRIPT',
  'DOWNLOADS_DIR',
  'SKILLS_DIR',
  'ENABLE_IM',
  'TELEGRAM_BOT_TOKEN',
  'TELEGRAM_ALLOWED_CHAT_IDS',
  'FEISHU_APP_ID',
  'FEISHU_APP_SECRET',
  'FEISHU_ALLOWED_USER_IDS',
  'FEISHU_ENVIRONMENT',
  'FEISHU_DOMAIN',
  'DISCORD_BOT_TOKEN',
  'DISCORD_ALLOWED_USER_IDS',
  'DISCORD_ALLOWED_CHANNEL_IDS',
  'DISCORD_ALLOWED_GUILD_IDS',
]

const SECRET_SUFFIX = /_KEY|_SECRET|_TOKEN|API_KEY/i

function parseArgs(argv) {
  const args = { printEnv: false, withDevDefaults: false }
  for (const a of argv) {
    if (a === '--print-env')
      args.printEnv = true
    if (a === '--with-dev-defaults')
      args.withDevDefaults = true
  }
  return args
}

function maskValue(key, raw) {
  if (raw === undefined || raw === '')
    return '(空)'
  if (SECRET_SUFFIX.test(key) && raw.length > 8)
    return `${raw.slice(0, 4)}…${raw.slice(-4)} (长度 ${raw.length})`
  return raw
}

function loadEnvFiles() {
  if (fs.existsSync(envFile)) {
    dotenv.config({ path: envFile })
    console.log('[run-dist] 已加载', envFile)
  }
  else {
    console.warn('[run-dist] 未找到 .env:', envFile)
    if (fs.existsSync(exampleFile)) {
      dotenv.config({ path: exampleFile })
      console.warn('[run-dist] 已用 .env.example 作为后备（请复制为 .env 并修改密钥）')
    }
  }
}

function applyDevDefaults() {
  const logs = path.join(root, 'logs')
  const downloads = path.join(root, '.dev-downloads')
  const skills = path.join(root, '.dev-skills')
  for (const d of [logs, downloads, skills]) {
    if (!fs.existsSync(d))
      fs.mkdirSync(d, { recursive: true })
  }
  if (!process.env.CHECKPOINT_DIR)
    process.env.CHECKPOINT_DIR = logs
  if (!process.env.DOWNLOADS_DIR)
    process.env.DOWNLOADS_DIR = downloads
  if (!process.env.SKILLS_DIR)
    process.env.SKILLS_DIR = skills
  if (!process.env.START_SCRIPT)
    process.env.START_SCRIPT = indexMjs
  /** src/database/conversations 在 import 时必须同时有这两项，否则会抛错退出 */
  if (!process.env.ROXY_USER_ID?.trim())
    process.env.ROXY_USER_ID = 'dev-local-user'
  if (!process.env.ROXY_WORKSPACE_ID?.trim())
    process.env.ROXY_WORKSPACE_ID = 'dev-local-workspace'
  console.log('[run-dev-defaults] CHECKPOINT_DIR=', process.env.CHECKPOINT_DIR)
  console.log('[run-dev-defaults] DOWNLOADS_DIR=', process.env.DOWNLOADS_DIR)
  console.log('[run-dev-defaults] SKILLS_DIR=', process.env.SKILLS_DIR)
  console.log('[run-dev-defaults] START_SCRIPT=', process.env.START_SCRIPT)
  console.log('[run-dev-defaults] ROXY_USER_ID=', process.env.ROXY_USER_ID)
  console.log('[run-dev-defaults] ROXY_WORKSPACE_ID=', process.env.ROXY_WORKSPACE_ID)
}

function checkRequired() {
  const required = [
    'LLM_PROVIDER',
    'LLM_MODEL',
    'LLM_API_KEY',
    'START_SCRIPT',
    'DOWNLOADS_DIR',
    'SKILLS_DIR',
    'CHECKPOINT_DIR',
    'ROXY_USER_ID',
    'ROXY_WORKSPACE_ID',
  ]
  const missing = required.filter((k) => !process.env[k] || String(process.env[k]).trim() === '')
  if (missing.length) {
    console.error('[run-dist] 缺少必填环境变量:', missing.join(', '))
    console.error('[run-dist] 请配置 .env，或加上 --with-dev-defaults 自动填目录类变量（LLM_* 仍需自行设置）参考', exampleFile)
    process.exit(1)
  }
}

function printEnvSnapshot() {
  console.log('[run-dist] —— 环境变量快照（脱敏）——')
  for (const k of ALL_ENV_KEYS) {
    const v = process.env[k]
    console.log(`  ${k}=${maskValue(k, v)}`)
  }
  console.log('[run-dist] —— end ——')
}

const flags = parseArgs(process.argv.slice(2))
loadEnvFiles()
if (flags.withDevDefaults)
  applyDevDefaults()

checkRequired()

if (flags.printEnv)
  printEnvSnapshot()

if (!fs.existsSync(indexMjs)) {
  console.error('[run-dist] 不存在:', indexMjs)
  console.error('[run-dist] 请先在该包目录执行: pnpm build')
  process.exit(1)
}

const child = spawn(process.execPath, [indexMjs], {
  cwd: root,
  env: { ...process.env },
  stdio: 'inherit',
})

child.on('error', (err) => {
  console.error('[run-dist] 子进程错误:', err)
  process.exit(1)
})

child.on('exit', (code, signal) => {
  if (signal)
    console.error('[run-dist] 子进程收到信号:', signal)
  process.exit(code ?? 1)
})
