import { describe, expect, it } from 'vitest'
import { generatedArtifactMimeType } from './fileManager'

describe('generatedArtifactMimeType', () => {
  it('maps accepted binary and script artifacts to upload MIME types', () => {
    expect(generatedArtifactMimeType('screen.png')).toBe('image/png')
    expect(generatedArtifactMimeType('bundle.zip')).toBe('application/zip')
    expect(generatedArtifactMimeType('automation.js')).toBe('text/javascript')
    expect(generatedArtifactMimeType('automation.ts')).toBe('text/typescript')
  })

  it('normalizes markdown and document-like text to text/plain', () => {
    expect(generatedArtifactMimeType('report.md')).toBe('text/plain')
    expect(generatedArtifactMimeType('page.html')).toBe('text/plain')
    expect(generatedArtifactMimeType('config.yaml')).toBe('text/plain')
  })

  it('returns undefined for unsupported binary extensions', () => {
    expect(generatedArtifactMimeType('archive.exe')).toBeUndefined()
    expect(generatedArtifactMimeType('unknown.bin')).toBeUndefined()
  })
})
