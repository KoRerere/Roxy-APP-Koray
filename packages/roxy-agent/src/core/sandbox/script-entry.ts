export type SandboxScriptEntry = Record<string, unknown>

export type SandboxScriptReturnValue = string | void

export const LOGIN_REQUIRED_SCRIPT_RESULT = 'LoginRequired'

export function isLoginRequired(value: unknown) {
  return value === LOGIN_REQUIRED_SCRIPT_RESULT
}

export async function executeSandboxScriptEntry(
  namespace: SandboxScriptEntry,
  options: unknown,
): Promise<SandboxScriptReturnValue> {
  if (typeof namespace.main === 'function') {
    const result = await namespace.main(options)
    if (result !== undefined && typeof result !== 'string') {
      throw new TypeError('Script main() must return a string or undefined.')
    }
    return result
  }

  throw new Error('Script has no exported main() function; nothing to run.')
}
