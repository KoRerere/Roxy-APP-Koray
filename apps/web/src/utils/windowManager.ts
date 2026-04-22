import { shallowRef, triggerRef } from 'vue'

class WindowManager {
  /** Keep Window instances raw to avoid Vue touching cross-origin frame internals. */
  winMap = shallowRef<Map<string, Window>>(new Map<string, Window>())

  constructor() {
    setInterval(() => {
      let hasClosedWindow = false

      this.winMap.value.forEach((win, name) => {
        if (win.closed) {
          this.winMap.value.delete(name)
          hasClosedWindow = true
        }
      })

      if (hasClosedWindow) {
        triggerRef(this.winMap)
      }
    }, 1000)
  }

  open(url: string, name: string) {
    const win = window.open(url, name)
    if (!win)
      return null

    this.winMap.value.set(name, win)
    triggerRef(this.winMap)

    return win
  }

  broadcast(data: any) {
    for (const win of this.winMap.value.values()) {
      win.postMessage(data, '*')
    }
  }

  closeAll() {
    for (const win of this.winMap.value.values()) {
      win.close()
    }
    this.winMap.value.clear()
    triggerRef(this.winMap)
  }
}

export const windowManager = new WindowManager()
