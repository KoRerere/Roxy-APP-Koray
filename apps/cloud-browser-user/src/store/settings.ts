import { defineStore } from 'pinia'
import { http } from '~/plugins/axios'
import { get, set } from '~/utils/localstorage'

// 单次 wheel 事件下发到远端的 delta 上限。远端 neko 会把该值当作 X11 滚轮
// 点击次数回放（每次 ~53~120px），值越大单次轻滚在远端走得越远。
// 现已改为滚轮节流窗口结束时补发累积增量，单窗口最多发出 2 次 delta；
// 因此把上限从 3 下调到 2，保持实际滚动幅度与之前相当。
const DEFAULT_SCROLL_DELTA = 2
// 历史版本曾使用 24/60，以及 neko 官方默认 10，这些值都会让远端滚动过快；
// 3 是引入累积补发前的默认值，同样需要迁回新默认值，避免老用户残留。
const LEGACY_SCROLL_DELTAS = new Set([3, 10, 24, 60])

interface KeyboardLayouts {
  [code: string]: string
}

export const useSettingsStore = defineStore('settings', {
  state: () => ({
    scroll: (() => {
      const savedScroll = get<number>('scroll', DEFAULT_SCROLL_DELTA)
      if (LEGACY_SCROLL_DELTAS.has(savedScroll)) {
        set('scroll', DEFAULT_SCROLL_DELTA)
        return DEFAULT_SCROLL_DELTA
      }

      return savedScroll
    })(),
    scroll_invert: get<boolean>('scroll_invert', true),
    autoplay: get<boolean>('autoplay', true),
    keyboard_layout: get<string>('keyboard_layout', 'us'),
    keyboard_layouts_list: {} as KeyboardLayouts,
  }),
  actions: {
    setScroll(scroll: number) {
      this.scroll = scroll
      set('scroll', scroll)
    },
    setInvert(value: boolean) {
      this.scroll_invert = value
      set('scroll_invert', value)
    },
    setAutoplay(value: boolean) {
      this.autoplay = value
      set('autoplay', value)
    },
    setKeyboardLayout(value: string) {
      this.keyboard_layout = value
      set('keyboard_layout', value)
    },
    setKeyboardLayoutsList(value: KeyboardLayouts) {
      this.keyboard_layouts_list = value
    },
    async initialize() {
      try {
        const req = await http.get<KeyboardLayouts>('keyboard_layouts.json')
        this.setKeyboardLayoutsList(req.data)
      }
      catch (err) {
        console.error(err)
      }
    },
  },
})
