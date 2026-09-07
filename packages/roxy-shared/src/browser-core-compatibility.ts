const MAC_OS_PLATFORM = 'mac'
const CHROME_CORE_TYPE = 'chrome'

/** Chromium 151 的 macOS 构建基线为 macOS 13（Darwin 22）。 */
export const MIN_MACOS_DARWIN_VERSION = 22
export const MIN_CHROMIUM_CORE_VERSION = 151

function toMajorVersion(value: unknown) {
  const majorVersion = Number.parseInt(String(value ?? ''), 10)
  return Number.isFinite(majorVersion) ? majorVersion : undefined
}

export function isMacOs12OrLower(os: unknown, osVersion: unknown) {
  const normalizedOs = String(os ?? '').trim().toLowerCase()
  const majorVersion = toMajorVersion(osVersion)
  return normalizedOs === MAC_OS_PLATFORM && majorVersion !== undefined && majorVersion < MIN_MACOS_DARWIN_VERSION
}

export function isChromiumCoreUnsupported(
  os: unknown,
  osVersion: unknown,
  coreType: unknown,
  coreVersion: unknown,
) {
  const normalizedCoreType = String(coreType ?? '').trim().toLowerCase() || CHROME_CORE_TYPE
  const majorVersion = toMajorVersion(coreVersion)
  return isMacOs12OrLower(os, osVersion)
    && normalizedCoreType === CHROME_CORE_TYPE
    && majorVersion !== undefined
    && majorVersion >= MIN_CHROMIUM_CORE_VERSION
}
