export function parseIntelligent(str: string) {
  return str.match(/^(?!:)(?:(?<platform>https?:\/\/[^:\s\{]+(?:\/[^:\s\{]*)*))?(?:(?::)?(?<username>[^:{}\s]+)(?::(?<password>[^:{}\s]+))?(?::(?<twoFactor>[^:{}\s]+))?)?(?:\{(?<remark>[^{}]+)\})?$/)?.groups ?? {}
}
