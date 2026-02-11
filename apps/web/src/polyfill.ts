if (typeof window !== 'undefined' && (!window.CSS || !window.CSS.px)) {
  // @ts-ignore
  window.CSS = window.CSS || {}

  class CSSUnitValue {
    value: number
    unit: string

    constructor(value: number, unit: string) {
      this.value = value
      this.unit = unit
    }

    toString() {
      return `${this.value}${this.unit}`
    }
  }

  const units: (keyof typeof CSS)[] = [
    'number',
    'percent',
    'em',
    'ex',
    'ch',
    'rem',
    'vw',
    'vh',
    'vmin',
    'vmax',
    'cm',
    'mm',
    'in',
    'pt',
    'pc',
    'px',
    'Q',
    'deg',
    'grad',
    'rad',
    'turn',
    's',
    'ms',
    'Hz',
    'kHz',
    'dpi',
    'dpcm',
    'dppx',
    'fr',
  ]

  units.forEach((unit) => {
    if (!window.CSS[unit]) {
      window.CSS[unit] = (value: number) => new CSSUnitValue(value, unit === 'number' ? '' : unit)
    }
  })
}

if (typeof window !== 'undefined' && !window.requestIdleCallback) {
  window.requestIdleCallback = function (cb: any) {
    const start = Date.now()
    return window.setTimeout(() => {
      cb({
        didTimeout: false,
        timeRemaining() {
          return Math.max(0, 50 - (Date.now() - start))
        },
      })
    }, 1)
  }

  window.cancelIdleCallback = function (id: any) {
    window.clearTimeout(id)
  }
}
