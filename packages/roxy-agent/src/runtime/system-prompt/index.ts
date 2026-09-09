import type { AiAgentModelApiFormat } from '@/api/agentApiClient'
import type { RuntimeSystemContextOptions } from '../prompt-context'
import { renderRuntimeSystemContext } from '../prompt-context'
import roxyPrompt from './roxy-prompt.md?raw'

const APPLY_PATCH_START = '<!-- ROXY_APPLY_PATCH_START -->'
const APPLY_PATCH_END = '<!-- ROXY_APPLY_PATCH_END -->'
const MAIN_AGENT_START = '<!-- ROXY_MAIN_AGENT_START -->'
const MAIN_AGENT_END = '<!-- ROXY_MAIN_AGENT_END -->'
const GENERAL_PURPOSE_AGENT_START = '<!-- ROXY_GENERAL_PURPOSE_AGENT_START -->'
const GENERAL_PURPOSE_AGENT_END = '<!-- ROXY_GENERAL_PURPOSE_AGENT_END -->'
const FILE_INSPECTION_RULE = '<!-- ROXY_FILE_INSPECTION_RULE -->'
const SEARCH_WORK_RULE = '<!-- ROXY_SEARCH_WORK_RULE -->'
const MEMORY_SEARCH_TOOL = '<!-- ROXY_MEMORY_SEARCH_TOOL -->'
const MEMORY_DISCOVERY_TOOL = '<!-- ROXY_MEMORY_DISCOVERY_TOOL -->'

const RIPGREP_FILE_INSPECTION_RULE = '- Use `read_file` to inspect known files. For directory listings, text search, or file search, use `exec_command` with `rg` or `rg --files` first; if `rg` is unavailable or fails, use the next best available command without fuss.'
const DEFAULT_FILE_INSPECTION_RULE = '- Use `read_file` and `grep` to inspect files before making assumptions about their contents. For directory listings or file search, use `exec_command` with the appropriate shell command.'
const RIPGREP_SEARCH_WORK_RULE = '- When you search for text or files, reach first for `exec_command` with `rg` or `rg --files`; they are much faster than grep-style scans. If `rg` is unavailable or fails, use the next best tool without fuss.'
const DEFAULT_SEARCH_WORK_RULE = '- When you search file contents, use `grep` or `exec_command` as appropriate. When you search filenames or list directories, use `exec_command` with the appropriate shell command.'
const RIPGREP_MEMORY_SEARCH_TOOL = '`exec_command` with `rg`'
const DEFAULT_MEMORY_SEARCH_TOOL = '`grep`'

interface PromptBlock {
  start: string
  end: string
  include: boolean
}

interface HostToolPromptOptions {
  hasRipgrep?: boolean
}

function extractPromptBlock(prompt: string, start: string, end: string): string {
  const startIndex = prompt.indexOf(start)
  const endIndex = prompt.indexOf(end, startIndex + start.length)
  if (startIndex < 0 || endIndex < 0) {
    throw new Error(`Missing system prompt block markers: ${start} / ${end}`)
  }

  return prompt.slice(startIndex + start.length, endIndex).trim()
}

function renderPromptBlock(prompt: string, block: PromptBlock): string {
  const startIndex = prompt.indexOf(block.start)
  const endIndex = prompt.indexOf(block.end, startIndex + block.start.length)
  if (startIndex < 0 || endIndex < 0) {
    throw new Error(`Missing system prompt block markers: ${block.start} / ${block.end}`)
  }

  const contentEnd = endIndex + block.end.length
  const replacement = block.include
    ? prompt.slice(startIndex + block.start.length, endIndex).trim()
    : ''

  return `${prompt.slice(0, startIndex)}${replacement}${prompt.slice(contentEnd)}`
}

function renderRoxyPrompt(blocks: PromptBlock[]): string {
  return blocks.reduce(renderPromptBlock, roxyPrompt.trim()).trim()
}

function replacePromptPlaceholder(prompt: string, placeholder: string, replacement: string): string {
  return prompt.replaceAll(placeholder, replacement)
}

function renderHostToolPrompt(prompt: string, options: HostToolPromptOptions): string {
  const hasRipgrep = options.hasRipgrep === true
  return [
    [FILE_INSPECTION_RULE, hasRipgrep ? RIPGREP_FILE_INSPECTION_RULE : DEFAULT_FILE_INSPECTION_RULE],
    [SEARCH_WORK_RULE, hasRipgrep ? RIPGREP_SEARCH_WORK_RULE : DEFAULT_SEARCH_WORK_RULE],
    [MEMORY_SEARCH_TOOL, hasRipgrep ? RIPGREP_MEMORY_SEARCH_TOOL : DEFAULT_MEMORY_SEARCH_TOOL],
    [MEMORY_DISCOVERY_TOOL, hasRipgrep ? RIPGREP_MEMORY_SEARCH_TOOL : DEFAULT_MEMORY_SEARCH_TOOL],
  ].reduce(
    (current, [placeholder, replacement]) => replacePromptPlaceholder(current, placeholder, replacement),
    prompt,
  )
}

function renderMainSystemPrompt(options: HostToolPromptOptions = {}): string {
  return renderHostToolPrompt(renderRoxyPrompt([
    { start: APPLY_PATCH_START, end: APPLY_PATCH_END, include: false },
    { start: MAIN_AGENT_START, end: MAIN_AGENT_END, include: true },
    { start: GENERAL_PURPOSE_AGENT_START, end: GENERAL_PURPOSE_AGENT_END, include: false },
  ]), options)
}

export const APPLY_PATCH_SYSTEM_PROMPT = extractPromptBlock(
  roxyPrompt,
  APPLY_PATCH_START,
  APPLY_PATCH_END,
)

export const ROXY_MAIN_SYSTEM_PROMPT = renderMainSystemPrompt()

export interface RuntimeSystemPromptOptions {
  apiFormat?: AiAgentModelApiFormat
  enableApplyPatch?: boolean
  includeSubagentInstructions?: boolean
  includeGeneralPurposeInstructions?: boolean
  hasRipgrep?: boolean
  runtimeContext?: RuntimeSystemContextOptions
}

export function createRuntimeSystemPrompt(options: RuntimeSystemPromptOptions = {}): string {
  const prompt = renderHostToolPrompt(renderRoxyPrompt([
    {
      start: APPLY_PATCH_START,
      end: APPLY_PATCH_END,
      include: options.apiFormat === 'openai' && options.enableApplyPatch !== false,
    },
    {
      start: MAIN_AGENT_START,
      end: MAIN_AGENT_END,
      include: options.includeSubagentInstructions !== false,
    },
    {
      start: GENERAL_PURPOSE_AGENT_START,
      end: GENERAL_PURPOSE_AGENT_END,
      include: options.includeGeneralPurposeInstructions === true,
    },
  ]), options)
  return options.runtimeContext
    ? `${prompt}\n\n${renderRuntimeSystemContext(options.runtimeContext)}`
    : prompt
}

export interface GeneralPurposeSystemPromptOptions {
  apiFormat?: AiAgentModelApiFormat
  enableApplyPatch?: boolean
  hasRipgrep?: boolean
  runtimeContext?: RuntimeSystemContextOptions
}

export function createGeneralPurposeSystemPrompt(options: GeneralPurposeSystemPromptOptions = {}): string {
  return createRuntimeSystemPrompt({
    apiFormat: options.apiFormat,
    enableApplyPatch: options.enableApplyPatch,
    includeSubagentInstructions: false,
    includeGeneralPurposeInstructions: true,
    hasRipgrep: options.hasRipgrep,
    runtimeContext: options.runtimeContext,
  })
}
