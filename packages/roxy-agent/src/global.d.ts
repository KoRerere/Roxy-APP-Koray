/** Runtime Promise APIs supplied by src/core/polyfill.ts for older Node versions. */
interface PromiseConstructor {
  withResolvers: <T>() => PromiseWithResolvers<T>
}

declare module '*?raw' {
  const content: string
  export default content
}

declare module 'virtual:roxy-system-skills-zip' {
  export const systemSkillsZipBase64: string
  export const systemSkillsContentSha512: string
}
