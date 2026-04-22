import { defineStore } from 'pinia'
import { get, set } from '~/utils/localstorage'
import type { ScreenConfigurations, ScreenResolution } from '~/neko/types'

export const useVideoStore = defineStore('video', {
  state: () => ({
    index: -1,
    tracks: [] as MediaStreamTrack[],
    streams: [] as MediaStream[],
    configurations: [] as ScreenResolution[],
    width: 1280,
    height: 720,
    rate: 30,
    horizontal: 16,
    vertical: 9,
    volume: get<number>('volume', 100),
    muted: get<boolean>('muted', false),
    playing: false,
    playable: false,
  }),
  getters: {
    stream: (state) => state.streams[state.index],
    track: (state) => state.tracks[state.index],
    resolution: (state) => ({ w: state.width, h: state.height }),
  },
  actions: {
    play() {
      if (this.playable) {
        this.playing = true
      }
    },
    pause() {
      if (this.playable) {
        this.playing = false
      }
    },
    togglePlay() {
      if (this.playable) {
        this.playing = !this.playing
      }
    },
    setMuted(muted: boolean) {
      this.muted = muted
      set('muted', muted)
    },
    toggleMute() {
      this.muted = !this.muted
      set('muted', this.muted)
    },
    setPlayable(playable: boolean) {
      if (!playable && this.playing) {
        this.playing = false
      }
      this.playable = playable
    },
    setResolution({ width, height, rate }: { width: number; height: number; rate: number }) {
      this.width = width
      this.height = height
      this.rate = rate

      if ((height === 0 && width === 0) || height === 0 || width === 0) {
        return
      }

      if (height === width) {
        this.horizontal = 1
        this.vertical = 1
        return
      }

      let dividend = width
      let divisor = height
      let gcd = -1

      if (height > width) {
        dividend = height
        divisor = width
      }

      while (gcd === -1) {
        const remainder = dividend % divisor
        if (remainder === 0) {
          gcd = divisor
        } else {
          dividend = divisor
          divisor = remainder
        }
      }

      this.horizontal = width / gcd
      this.vertical = height / gcd
    },
    setConfigurations(configurations: ScreenConfigurations) {
      const data: ScreenResolution[] = []

      for (const configKey of Object.keys(configurations)) {
        const { width, height, rates } = configurations[configKey]
        if (width >= 600 && height >= 300) {
          for (const rateKey of Object.keys(rates)) {
            const rate = rates[rateKey]
            if (rate === 30 || rate === 60) {
              data.push({ width, height, rate })
            }
          }
        }
      }

      this.configurations = data.sort((a, b) => {
        if (b.width === a.width && b.height === a.height) {
          return b.rate - a.rate
        }
        if (b.width === a.width) {
          return b.height - a.height
        }
        return b.width - a.width
      })
    },
    setVolume(volume: number) {
      this.volume = volume
      set('volume', volume)
    },
    setStream(index: number) {
      this.index = index
    },
    addTrack([track, stream]: [MediaStreamTrack, MediaStream]) {
      this.tracks = this.tracks.concat([track])
      this.streams = this.streams.concat([stream])
    },
    delTrack(index: number) {
      this.streams = this.streams.filter((_, itemIndex) => itemIndex !== index)
      this.tracks = this.tracks.filter((_, itemIndex) => itemIndex !== index)
    },
    reset() {
      this.index = -1
      this.tracks = []
      this.streams = []
      this.configurations = []
      this.width = 1280
      this.height = 720
      this.rate = 30
      this.horizontal = 16
      this.vertical = 9
      this.playing = false
      this.playable = false
    },
  },
})
