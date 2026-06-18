export function parseIntelligent(str: string) {
  return str.match(/^(?!:)(?<platform>https?:\/\/[^:\s{]+)?(?::?(?<username>[^:{}\s]+)(?::(?<password>[^:{}\s]+))?(?::(?<twoFactor>[^:{}\s]+))?)?(?:\{(?<remark>[^{}]+)\})?$/)?.groups ?? {}
}

export function normalizeImportCellText(cellValue: unknown): string {
  if (cellValue == null || cellValue === '')
    return ''

  if (typeof cellValue === 'object' && cellValue !== null && 'text' in cellValue)
    return String((cellValue as { text: string }).text).trim()

  return String(cellValue).trim()
}
