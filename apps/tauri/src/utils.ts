export function isMacOS() {
  if (navigator.userAgentData?.platform) {
    return navigator.userAgentData.platform === 'macOS'
  }
  return /Mac/.test(navigator.platform)
}
