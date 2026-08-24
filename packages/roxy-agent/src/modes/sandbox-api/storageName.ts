const WINDOWS_RESERVED_NAMES = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i

function isUnsafeFileNameChar(char: string): boolean {
  return /[<>:"/\\|?*\u0000-\u001f\u007f]/.test(char)
}

/**
 * Convert a user-facing storage name into one flat cross-platform filename.
 * Common valid names stay readable; unsafe characters become '-'.
 */
export function toSafeStorageFileName(name: string, extension: string): string {
  const chars = Array.from(name)
  let lastNonTrailingDotOrSpace = chars.length - 1
  while (lastNonTrailingDotOrSpace >= 0 && /[. ]/.test(chars[lastNonTrailingDotOrSpace]!)) {
    lastNonTrailingDotOrSpace--
  }
  let firstNonLeadingDot = 0
  while (firstNonLeadingDot < chars.length && chars[firstNonLeadingDot] === '.') {
    firstNonLeadingDot++
  }

  let safeBase = chars
    .map((char, index) => {
      if (isUnsafeFileNameChar(char) || index > lastNonTrailingDotOrSpace || index < firstNonLeadingDot) {
        return '-'
      }
      return char
    })
    .join('')

  if (WINDOWS_RESERVED_NAMES.test(safeBase)) {
    safeBase = `${safeBase}-`
  }

  return `${safeBase}${extension}`
}
