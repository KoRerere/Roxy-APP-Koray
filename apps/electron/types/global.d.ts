export { }

declare global {
  var $t: (id: string, values?: Record<string, any>) => string
  namespace Express {
    export interface Response {
      success: <T = any>(data?: T, message?: string) => void
      error: (message?: unknown, code?: number) => void
    }
  }
}
