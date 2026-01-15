export function parseIntelligent(str: string) {
  return str.match(/^(?!:)(?<platform>https?:\/\/[^:\s{]+)?(?::?(?<username>[^:{}\s]+)(?::(?<password>[^:{}\s]+))?(?::(?<twoFactor>[^:{}\s]+))?)?(?:\{(?<remark>[^{}]+)\})?$/)?.groups ?? {}
}
