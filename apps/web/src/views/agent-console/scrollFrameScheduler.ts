export interface AnimationFrameHost {
  requestAnimationFrame: (callback: FrameRequestCallback) => number
  cancelAnimationFrame: (handle: number) => void
}

export class FrameTaskScheduler {
  private frame: number | undefined
  private task: (() => void) | undefined

  constructor(private readonly host: AnimationFrameHost) {}

  schedule(task: () => void): void {
    this.task = task
    if (this.frame !== undefined) {
      return
    }

    this.frame = this.host.requestAnimationFrame(() => {
      this.frame = undefined
      const pending = this.task
      this.task = undefined
      pending?.()
    })
  }

  cancel(): void {
    if (this.frame !== undefined) {
      this.host.cancelAnimationFrame(this.frame)
      this.frame = undefined
    }
    this.task = undefined
  }
}
