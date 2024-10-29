export { }

declare global {
  var $t: (key: string) => string
  namespace Express {
    export interface Response {
      success: <T = any>(data?: T, message?: string) => void
      error: (message?: unknown, code?: number) => void
    }
  }
}
