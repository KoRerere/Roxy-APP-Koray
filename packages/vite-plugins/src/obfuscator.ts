import JavaScriptObfuscator from 'javascript-obfuscator'
import { readdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { PluginOption, ResolvedConfig } from 'vite'

export function codeObfuscator(inputOptions?: JavaScriptObfuscator.ObfuscatorOptions): PluginOption {
  let config: ResolvedConfig
  const mergedOptions: JavaScriptObfuscator.ObfuscatorOptions = {
    compact: true,
    controlFlowFlattening: true,
    stringArray: true,
    stringArrayEncoding: ['base64'],
    ...inputOptions,
  };

  return [
    {
      name: 'roxy:code-obfuscator',
      enforce: 'post',
      apply: 'build',
      configResolved(resolvedConfig) {
        config = resolvedConfig
      },
      async closeBundle() {
        const { outDir } = config.build
        const files = await readdir(outDir)
        const cjsFiles = files.filter(file => file.endsWith('.cjs'))
        const jsFiles = files.filter(file => file.endsWith('.js'))
        const allFiles = [...cjsFiles, ...jsFiles]
        for (const file of allFiles) {
          const filePath = join(outDir, file)
          const content = await readFile(filePath, 'utf-8')
          const obfuscatedContent = JavaScriptObfuscator.obfuscate(content, mergedOptions).getObfuscatedCode()
          await writeFile(filePath, obfuscatedContent)
        }
      }
    },
  ]
}