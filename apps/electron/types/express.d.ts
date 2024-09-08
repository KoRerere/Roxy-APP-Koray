export { }

declare global {
  namespace Express {
    export interface Response {
      success: <T = any>(data: T, message?: string) => void
      error: (message?: unknown, code?: number) => void
    }
  }
}
