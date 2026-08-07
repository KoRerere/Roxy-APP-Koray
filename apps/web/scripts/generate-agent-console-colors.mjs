import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const webRoot = resolve(scriptDir, '..')
const colorDir = resolve(webRoot, 'src/views/agent-console/styles/Color')
const outputFile = resolve(webRoot, 'src/views/agent-console/styles/color-tokens.css')

const modes = {
  light: {
    input: resolve(colorDir, 'light.tokens.json'),
    selector: 'body.agent-console-window',
    colorScheme: 'light',
  },
  dark: {
    input: resolve(colorDir, 'dark.tokens.json'),
    selector: 'html[data-theme="dark"] body.agent-console-window,\nhtml.app-dark body.agent-console-window',
    colorScheme: 'dark',
  },
}

function extractCssVariableName(token) {
  const syntax = token?.$extensions?.['com.figma.codeSyntax']?.WEB
  const match = typeof syntax === 'string' ? syntax.match(/^var\((--[\w-]+)\)$/) : null
  return match?.[1]
}

function toRgbComponent(value) {
  return Math.round(Math.min(1, Math.max(0, value)) * 255)
}

function formatColor(value) {
  const alpha = value.alpha ?? 1
  const [red, green, blue] = value.components.map(toRgbComponent)

  if (alpha >= 0.999)
    return `#${[red, green, blue].map(component => component.toString(16).padStart(2, '0')).join('')}`.toUpperCase()

  return `rgba(${red}, ${green}, ${blue}, ${alpha.toFixed(4)})`
}

function collectColorTokens(source) {
  const tokens = []

  function walk(node) {
    for (const value of Object.values(node)) {
      if (!value || typeof value !== 'object')
        continue

      if (value.$type === 'color' && value.$value) {
        const name = extractCssVariableName(value)

        if (name)
          tokens.push([name, formatColor(value.$value)])

        continue
      }

      walk(value)
    }
  }

  walk(source)
  return tokens
}

function renderRule({ selector, colorScheme }, tokens) {
  const declarations = [
    `  color-scheme: ${colorScheme};`,
    ...tokens.map(([name, value]) => `  ${name}: ${value};`),
  ]

  return `${selector} {\n${declarations.join('\n')}\n}`
}

async function main() {
  const rules = []

  for (const mode of Object.values(modes)) {
    const source = JSON.parse(await readFile(mode.input, 'utf8'))
    rules.push(renderRule(mode, collectColorTokens(source)))
  }

  const header = [
    '/**',
    ' * This file is generated from ./Color/*.tokens.json.',
    ' * Run `pnpm -F web genAgentConsoleColors` after updating the Figma exports.',
    ' */',
  ].join('\n')

  const css = `${header}\n\n${rules.join('\n\n')}\n`

  await mkdir(dirname(outputFile), { recursive: true })
  await writeFile(outputFile, css)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
