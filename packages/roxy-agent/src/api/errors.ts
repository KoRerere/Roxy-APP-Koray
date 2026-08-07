export class AiAgentHttpError extends Error {
  readonly status: number
  readonly code?: number | string
  readonly payload?: unknown

  constructor(status: number, message: string, extra?: { code?: number | string, payload?: unknown }) {
    super(message)
    this.name = 'AiAgentHttpError'
    this.status = status
    this.code = extra?.code
    this.payload = extra?.payload
  }
}
