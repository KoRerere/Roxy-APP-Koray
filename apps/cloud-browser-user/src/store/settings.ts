import { defineStore } from 'pinia'
import { get, set } from '~/utils/localstorage'
import { http } from '~/plugins/axios'

interface KeyboardLayouts {
  [code: string]: string
}

export const useSettingsStore = defineStore('settings', {
  state: () => ({
    scroll: get<number>('scroll', 10),
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
      } catch (err) {
        console.error(err)
      }
    },
  },
})
