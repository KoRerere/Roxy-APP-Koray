export function getDefaultTargetsForHost(): string[] {
  if (process.platform === 'darwin')
    return ['aarch64-apple-darwin', 'x86_64-apple-darwin']
  if (process.platform === 'win32')
    return ['x86_64-pc-windows-msvc', 'i686-pc-windows-msvc']
  if (process.platform === 'linux')
    return ['x86_64-unknown-linux-gnu']
  return []
}
