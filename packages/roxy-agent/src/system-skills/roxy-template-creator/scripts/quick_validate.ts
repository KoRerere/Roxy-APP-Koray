#!/usr/bin/env node

import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'

const MAX_SKILL_NAME_LENGTH = 64
const MAX_SKILL_DESCRIPTION_LENGTH = 1_024
const MAX_SKILL_FILE_SIZE_BYTES = 32 * 1024
const SKILL_NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const COMPOSER_TOKEN_PATTERN
  = /\[(@profile):([^\]]*)\]\(([^)]*)\)|\[(input|url):([^\]]+)\](?:\(([^)]*)\))?/g
const MALFORMED_COMPOSER_TOKEN_PATTERN = /\[(?:@profile|input|url):/
const DOUBLE_BRACE_PLACEHOLDER_PATTERN = /\{\{[^{}\r\n]+\}\}/
const DOLLAR_PLACEHOLDER_PATTERN = /\$(?:\{[A-Z_]\w*\}|[A-Z_]\w*)/i

export interface SkillValidationResult {
  ok: boolean
  skillPath: string
  errors: string[]
}

export interface ComposerPromptValidationResult {
  ok: boolean
  errors: string[]
}

interface CliOptions {
  promptFile?: string
  skillPath: string
}

interface ParsedSkillDocument {
  body: string
  frontmatter: string
}

interface ParsedScalar {
  errors: string[]
  value?: string
}

function maskMatchedRange(maskedPrompt: string[], index: number, length: number): void {
  for (let offset = index; offset < index + length; offset += 1) {
    maskedPrompt[offset] = ' '
  }
}

export function validateComposerPrompt(prompt: string): ComposerPromptValidationResult {
  const errors: string[] = []
  if (!prompt.trim()) {
    return { ok: false, errors: ['Companion prompt must not be empty.'] }
  }

  if (prompt.includes('[@script:')) {
    errors.push('Companion prompt must not contain @script Composer tokens.')
  }
  if (prompt.includes('[$')) {
    errors.push('Companion prompt must not contain Skill-reference Composer tokens.')
  }
  if (DOUBLE_BRACE_PLACEHOLDER_PATTERN.test(prompt)) {
    errors.push('Companion prompt must use Composer tokens instead of {{...}} placeholders.')
  }
  if (DOLLAR_PLACEHOLDER_PATTERN.test(prompt)) {
    errors.push(
      'Companion prompt must use Composer tokens instead of dollar-variable placeholders.',
    )
  }

  const maskedPrompt = prompt.split('')
  for (const match of prompt.matchAll(COMPOSER_TOKEN_PATTERN)) {
    const raw = match[0]
    const index = match.index ?? 0
    maskMatchedRange(maskedPrompt, index, raw.length)

    if (match[1] === '@profile') {
      errors.push('Companion prompt must not contain browser-window selection tokens; select windows when using the template.')
      continue
    }

    const kind = match[4] ?? ''
    const label = match[5] ?? ''
    const target = match[6]
    if (!label.trim()) {
      errors.push(`Composer ${kind || 'input'} token must have a non-empty label.`)
    }
    if (label.includes('\n') || label.includes('\r')) {
      errors.push(`Composer ${kind || 'input'} token label must stay on one line.`)
    }
    if (label.includes('[')) {
      errors.push(`Composer ${kind || 'input'} token label must not contain nested brackets.`)
    }
    if (!raw.includes('](') || target === undefined) {
      errors.push(
        `Composer ${kind || 'input'} token must use [${kind || 'input'}:Label](default) syntax.`,
      )
    }
    else if (target.includes('\n') || target.includes('\r')) {
      errors.push(`Composer ${kind || 'input'} token value must stay on one line.`)
    }
    else if (target.includes('[') || target.includes(']')) {
      errors.push(`Composer ${kind || 'input'} token value must not contain nested brackets.`)
    }
  }

  if (MALFORMED_COMPOSER_TOKEN_PATTERN.test(maskedPrompt.join(''))) {
    errors.push('Companion prompt contains a malformed input, url, or @profile Composer token.')
  }
  return { ok: errors.length === 0, errors }
}

function parseSkillDocument(content: string): ParsedSkillDocument | null {
  const normalized = content.replace(/^\uFEFF/, '')
  const match = normalized.match(
    /^---[^\S\r\n]*\r?\n([\s\S]*?)\r?\n---[^\S\r\n]*(?:\r?\n|$)([\s\S]*)$/,
  )
  if (!match) {
    return null
  }

  return {
    frontmatter: match[1] ?? '',
    body: match[2] ?? '',
  }
}

function stripPlainScalarComment(value: string): string {
  const comment = value.search(/\s+#/)
  return (comment === -1 ? value : value.slice(0, comment)).trimEnd()
}

function parseScalarValue(rawValue: string, key: string): ParsedScalar {
  const value = rawValue.trim()
  if (!value) {
    return { errors: [`Frontmatter '${key}' must use a non-empty single-line scalar.`] }
  }

  if (value.startsWith('"')) {
    try {
      const parsed: unknown = JSON.parse(value)
      return typeof parsed === 'string'
        ? { value: parsed, errors: [] }
        : { errors: [`Frontmatter '${key}' must be a string.`] }
    }
    catch (error) {
      return {
        errors: [
          `Frontmatter '${key}' has an invalid double-quoted scalar: ${error instanceof Error ? error.message : String(error)}`,
        ],
      }
    }
  }

  if (value.startsWith('\'')) {
    if (value.length < 2 || !value.endsWith('\'')) {
      return { errors: [`Frontmatter '${key}' has an unterminated single-quoted scalar.`] }
    }
    return {
      value: value.slice(1, -1).replaceAll('\'\'', '\''),
      errors: [],
    }
  }

  if (value === '|' || value === '>' || value.startsWith('[') || value.startsWith('{')) {
    return { errors: [`Frontmatter '${key}' must use a single-line string scalar.`] }
  }

  const plain = stripPlainScalarComment(value)
  if (!plain || /^(?:null|~|true|false|[-+]?\d+(?:\.\d+)?)$/i.test(plain)) {
    return { errors: [`Frontmatter '${key}' must be a string.`] }
  }
  return { value: plain, errors: [] }
}

function readFrontmatterScalar(frontmatter: string, key: string): ParsedScalar {
  const values: string[] = []
  const errors: string[] = []

  for (const line of frontmatter.split(/\r?\n/)) {
    if (!line || /^\s/.test(line) || line.trimStart().startsWith('#')) {
      continue
    }

    const match = line.match(/^([\w-]+)\s*:(.*)$/)
    if (!match || match[1] !== key) {
      continue
    }
    values.push(match[2] ?? '')
  }

  if (values.length === 0) {
    return { errors: [`Missing required frontmatter '${key}'.`] }
  }
  if (values.length > 1) {
    errors.push(`Frontmatter '${key}' must not be duplicated.`)
  }

  const parsed = parseScalarValue(values[0] ?? '', key)
  return {
    ...(parsed.value !== undefined ? { value: parsed.value } : {}),
    errors: [...errors, ...parsed.errors],
  }
}

function containsTodoPlaceholder(body: string): boolean {
  let fenceMarker: '`' | '~' | undefined
  let fenceLength = 0

  for (const line of body.split(/\r?\n/)) {
    const fence = readFence(line)
    if (fence) {
      const { marker, tail } = fence
      if (!fenceMarker) {
        fenceMarker = marker[0] as '`' | '~'
        fenceLength = marker.length
      }
      else if (marker[0] === fenceMarker && marker.length >= fenceLength && !tail.trim()) {
        fenceMarker = undefined
        fenceLength = 0
      }
      continue
    }

    if (!fenceMarker && /^ {0,3}\[TODO:[^\n]*\][ \t]*$/.test(line)) {
      return true
    }
  }

  return false
}

function readFence(line: string): { marker: string, tail: string } | null {
  const withoutIndent = line.trimStart()
  const withoutListMarker = withoutIndent.replace(/^(?:[-+*]|\d+[.)])\s+/, '')
  const markerCharacter = withoutListMarker[0]
  if (markerCharacter !== '`' && markerCharacter !== '~') {
    return null
  }

  let markerLength = 0
  while (withoutListMarker[markerLength] === markerCharacter) {
    markerLength += 1
  }
  if (markerLength < 3) {
    return null
  }

  return {
    marker: withoutListMarker.slice(0, markerLength),
    tail: withoutListMarker.slice(markerLength),
  }
}

async function resolveSkillPath(inputPath: string): Promise<string> {
  const resolved = path.resolve(inputPath)
  const inputStat = await stat(resolved)
  return inputStat.isDirectory() ? path.join(resolved, 'SKILL.md') : resolved
}

export async function validateSkillPath(inputPath: string): Promise<SkillValidationResult> {
  let skillPath: string
  try {
    skillPath = await resolveSkillPath(inputPath)
  }
  catch (error) {
    return {
      ok: false,
      skillPath: path.resolve(inputPath),
      errors: [
        `Could not access Skill path: ${error instanceof Error ? error.message : String(error)}`,
      ],
    }
  }

  let content: string
  try {
    const skillStat = await stat(skillPath)
    if (!skillStat.isFile()) {
      return { ok: false, skillPath, errors: ['SKILL.md is not a regular file.'] }
    }
    if (skillStat.size > MAX_SKILL_FILE_SIZE_BYTES) {
      return {
        ok: false,
        skillPath,
        errors: [`SKILL.md exceeds ${MAX_SKILL_FILE_SIZE_BYTES} bytes.`],
      }
    }
    content = await readFile(skillPath, 'utf8')
  }
  catch (error) {
    return {
      ok: false,
      skillPath,
      errors: [
        `Could not read SKILL.md: ${error instanceof Error ? error.message : String(error)}`,
      ],
    }
  }

  const document = parseSkillDocument(content)
  if (!document) {
    return {
      ok: false,
      skillPath,
      errors: ['SKILL.md must start with closed YAML frontmatter delimited by --- lines.'],
    }
  }

  const errors: string[] = []
  const name = readFrontmatterScalar(document.frontmatter, 'name')
  const description = readFrontmatterScalar(document.frontmatter, 'description')
  errors.push(...name.errors, ...description.errors)

  if (name.value !== undefined) {
    if (name.value.length > MAX_SKILL_NAME_LENGTH) {
      errors.push(`Skill name exceeds ${MAX_SKILL_NAME_LENGTH} characters.`)
    }
    if (!SKILL_NAME_PATTERN.test(name.value)) {
      errors.push('Skill name must contain lowercase letters, digits, and single hyphens only.')
    }
    const directoryName = path.basename(path.dirname(skillPath))
    if (name.value !== directoryName) {
      errors.push(`Skill name '${name.value}' must match directory name '${directoryName}'.`)
    }
    if (name.value.startsWith('[TODO:')) {
      errors.push('Frontmatter \'name\' contains an unfinished TODO placeholder.')
    }
  }

  if (description.value !== undefined) {
    if (!description.value.trim()) {
      errors.push('Skill description must not be empty.')
    }
    if (description.value.length > MAX_SKILL_DESCRIPTION_LENGTH) {
      errors.push(`Skill description exceeds ${MAX_SKILL_DESCRIPTION_LENGTH} characters.`)
    }
    if (description.value.startsWith('[TODO:')) {
      errors.push('Frontmatter \'description\' contains an unfinished TODO placeholder.')
    }
  }

  if (!document.body.trim()) {
    errors.push('SKILL.md must contain instructions after frontmatter.')
  }
  if (containsTodoPlaceholder(document.body)) {
    errors.push('SKILL.md contains an unfinished TODO placeholder outside a code fence.')
  }

  return { ok: errors.length === 0, skillPath, errors }
}

function printUsage(): void {
  console.error(
    'Usage: node --experimental-strip-types quick_validate.ts '
    + '<skill-directory-or-SKILL.md> [--prompt-file <path>]',
  )
}

function parseCliOptions(args: string[]): { errors: string[], options?: CliOptions } {
  if (args.length === 0) {
    return { errors: ['Missing Skill path.'] }
  }

  const skillPath = args[0]!
  let promptFile: string | undefined
  const errors: string[] = []

  for (let index = 1; index < args.length; index += 1) {
    const argument = args[index]
    if (argument === '--prompt-file') {
      const value = args[index + 1]
      if (!value || value.startsWith('--')) {
        errors.push('--prompt-file requires a file path.')
      }
      else if (promptFile !== undefined) {
        errors.push('--prompt-file must not be repeated.')
        index += 1
      }
      else {
        promptFile = value
        index += 1
      }
      continue
    }
    errors.push(`Unknown argument: ${argument}`)
  }

  if (errors.length > 0) {
    return { errors }
  }

  return {
    errors: [],
    options: {
      skillPath,
      ...(promptFile ? { promptFile } : {}),
    },
  }
}

async function readPrompt(
  promptFile: string,
): Promise<{ errors: string[], path: string, prompt?: string }> {
  const promptPath = path.resolve(promptFile)
  try {
    const promptStat = await stat(promptPath)
    if (!promptStat.isFile()) {
      return { path: promptPath, errors: ['Companion prompt path is not a regular file.'] }
    }

    return { path: promptPath, prompt: await readFile(promptPath, 'utf8'), errors: [] }
  }
  catch (error) {
    return {
      path: promptPath,
      errors: [
        `Could not read companion prompt: ${error instanceof Error ? error.message : String(error)}`,
      ],
    }
  }
}

async function main(args: string[]): Promise<void> {
  const parsedCli = parseCliOptions(args)
  if (!parsedCli.options) {
    printUsage()
    for (const error of parsedCli.errors) {
      console.error(`- ${error}`)
    }
    process.exitCode = 1
    return
  }

  const skillResult = await validateSkillPath(parsedCli.options.skillPath)
  const errors = skillResult.errors.map(error => `Skill: ${error}`)
  let promptPath: string | undefined

  if (parsedCli.options.promptFile) {
    const promptFile = await readPrompt(parsedCli.options.promptFile)
    promptPath = promptFile.path
    errors.push(...promptFile.errors.map(error => `Prompt: ${error}`))
    if (promptFile.prompt !== undefined) {
      const promptResult = validateComposerPrompt(promptFile.prompt)
      errors.push(...promptResult.errors.map(error => `Prompt: ${error}`))
    }
  }

  if (errors.length > 0) {
    console.error(`Validation failed: ${skillResult.skillPath}`)
    for (const error of errors) {
      console.error(`- ${error}`)
    }
    process.exitCode = 1
    return
  }

  console.log(`Skill is valid: ${skillResult.skillPath}`)
  if (promptPath) {
    console.log(`Companion prompt is valid: ${promptPath}`)
  }
}

function isDirectRun(): boolean {
  const entryPath = process.argv[1]
  return Boolean(entryPath && pathToFileURL(path.resolve(entryPath)).href === import.meta.url)
}

if (isDirectRun()) {
  await main(process.argv.slice(2))
}
