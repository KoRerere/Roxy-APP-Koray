const PASTED_TEXT_FILE_MIN_LENGTH = 4000
const PASTED_TEXT_FILE_MIN_LINES = 40
const PASTED_TEXT_FILE_MIN_SINGLE_LINE_LENGTH = 1000

export function shouldConvertPastedTextToFile(text: string) {
  const normalized = text.trim()
  if (!normalized) {
    return false
  }

  const lines = normalized.split(/\r?\n/)
  return normalized.length >= PASTED_TEXT_FILE_MIN_LENGTH
    || lines.length >= PASTED_TEXT_FILE_MIN_LINES
    || lines.some(line => line.length >= PASTED_TEXT_FILE_MIN_SINGLE_LINE_LENGTH)
}
