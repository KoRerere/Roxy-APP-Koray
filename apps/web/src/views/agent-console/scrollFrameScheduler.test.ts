import { describe, expect, it, vi } from 'vitest'
import { FrameTaskScheduler } from './scrollFrameScheduler'

describe('frame task scheduler', () => {
  it('coalesces repeated scroll requests into one latest task per animation frame', () => {
    // Regression: one streamed update could scroll immediately, schedule another
    // scroll, and be scheduled again by ResizeObserver in the same frame.
    // Fixed by: coalescing all requests behind one animation-frame callback.
    let callback: FrameRequestCallback | undefined
    const host = {
      requestAnimationFrame: vi.fn((next: FrameRequestCallback) => {
        callback = next
        return 7
      }),
      cancelAnimationFrame: vi.fn(),
    }
    const scheduler = new FrameTaskScheduler(host)
    const first = vi.fn()
    const latest = vi.fn()

    scheduler.schedule(first)
    scheduler.schedule(latest)

    expect(host.requestAnimationFrame).toHaveBeenCalledOnce()
    callback?.(16)
    expect(first).not.toHaveBeenCalled()
    expect(latest).toHaveBeenCalledOnce()
  })

  it('cancels a pending frame on disposal', () => {
    const host = {
      requestAnimationFrame: vi.fn(() => 9),
      cancelAnimationFrame: vi.fn(),
    }
    const scheduler = new FrameTaskScheduler(host)
    scheduler.schedule(() => {})

    scheduler.cancel()

    expect(host.cancelAnimationFrame).toHaveBeenCalledWith(9)
  })
})
