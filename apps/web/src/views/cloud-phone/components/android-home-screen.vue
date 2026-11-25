<script setup lang="ts">
import androidWallpaper from '/@/assets/images/cloud-phone/android-pink-wallpaper.jpg'
import { storeApps } from '../app-store-catalog'

/**
 * 模拟 Android 云手机桌面组件
 * 基于容器宽度（cqw）等比例缩放，在左侧大屏、右侧小屏及放大灯箱中均可高清无损呈现。
 */
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { usePreferredReducedMotion } from '@vueuse/core'

const props = withDefaults(defineProps<{
  timeText?: string
  dateText?: string
  /** 是否自动演示依次点开各个 APP */
  autoplay?: boolean
  /** 演示起始偏移：不同手机从不同 APP 开始，避免整墙同步 */
  offset?: number
  /** 是否真正播放视频；为 false 时只显示视频第一帧（右侧小屏用，减少卡顿） */
  playVideo?: boolean
  /** 指定视频：传入后替换这台手机打开 APP 后播放的第一条视频 */
  video?: string
}>(), {
  timeText: '4:40 PM',
  dateText: 'Thursday, Nov 19',
  autoplay: false,
  offset: 0,
  playVideo: true,
})

/** 不播放时用 #t 定位到第一帧作为静态封面 */
const videoSrc = (src: string) => (props.playVideo ? src : `${src}#t=0.1`)

/** 桌面图标取自应用商店的真实图标 */
function pick(ids: string[]) {
  return ids
    .map(id => storeApps.find(app => app.id === id))
    .filter((app): app is (typeof storeApps)[number] => !!app)
}
const gridApps = pick(['tiktok', 'instagram', 'facebook', 'whatsapp', 'netflix', 'spotify', 'twitch', 'disney'])
const dockRow = pick(['telegram', 'claude', 'primevideo', 'hulu'])

/* ---------------- 模拟点开 APP 并在 APP 内滚动 ---------------- */

/** 各 APP 的品牌主题：启动页背景 / APP 内背景 / 是否浅色 */
const THEME: Record<string, { splash: string, bg: string, light?: boolean }> = {
  tiktok: { splash: '#000000', bg: '#000000' },
  instagram: { splash: '#ffffff', bg: '#ffffff', light: true },
  facebook: { splash: '#ffffff', bg: '#F0F2F5', light: true },
  whatsapp: { splash: '#ffffff', bg: '#ffffff', light: true },
  netflix: { splash: '#000000', bg: '#141414' },
  spotify: { splash: '#121212', bg: '#121212' },
  twitch: { splash: '#0E0E10', bg: '#0E0E10' },
  disney: { splash: '#0B1B4D', bg: '#1A1D29' },
  telegram: { splash: '#ffffff', bg: '#ffffff', light: true },
  claude: { splash: '#F5F0E8', bg: '#F5F0E8', light: true },
  primevideo: { splash: '#0F171E', bg: '#0F171E' },
  hulu: { splash: '#0B0C0F', bg: '#0B0C0F' },
}
const ACCENT: Record<string, string> = {
  tiktok: '#FE2C55', instagram: '#D6249F', facebook: '#1877F2', whatsapp: '#25D366',
  netflix: '#E50914', spotify: '#1DB954', twitch: '#9146FF', disney: '#113CCF',
  telegram: '#2AABEE', claude: '#D97757', primevideo: '#00A8E1', hulu: '#1CE783',
}

const allApps = [...gridApps, ...dockRow]
/** 节奏（毫秒）：按下 → 启动页 → 进入 APP → 滚动两段后停住 */
const TIMING = { tap: 260, splash: 900, beforeScroll: 700, scroll1: 1600, hold: 900, scroll2: 1400 }

const reducedMotion = usePreferredReducedMotion()
const tappingId = ref<string | null>(null)
const phase = ref<'home' | 'splash' | 'app'>('home')
const scrollStep = ref(0)
const openApp = ref<(typeof allApps)[number] | null>(null)
const theme = computed(() => (openApp.value && THEME[openApp.value.id]) || { splash: '#111', bg: '#111' })
const accent = computed(() => (openApp.value && ACCENT[openApp.value.id]) || '#888')
const timers: ReturnType<typeof setTimeout>[] = []

function later(fn: () => void, ms: number) {
  timers.push(setTimeout(fn, ms))
}

function reset() {
  timers.forEach(clearTimeout)
  timers.length = 0
  tappingId.value = null
  openApp.value = null
  phase.value = 'home'
  scrollStep.value = 0
}

/** 一次性演示：点开一个 APP，滚动一会儿后停在 APP 内 */
function play() {
  const app = allApps[props.offset % allApps.length]
  let t = 500 + (props.offset % 7) * 260 // 错开每台手机的起始时间
  later(() => (tappingId.value = app.id), t)
  t += TIMING.tap
  later(() => {
    tappingId.value = null
    openApp.value = app
    phase.value = 'splash'
  }, t)
  t += TIMING.splash
  later(() => (phase.value = 'app'), t)
  t += TIMING.beforeScroll
  later(() => (scrollStep.value = 1), t)
  t += TIMING.scroll1 + TIMING.hold
  later(() => (scrollStep.value = 2), t)
}

const canPlay = computed(() => props.autoplay && reducedMotion.value !== 'reduce' && allApps.length > 0)

watch(canPlay, (ok) => {
  reset()
  if (ok) {
    play()
  }
}, { immediate: true })

onBeforeUnmount(reset)

/* ---------------- APP 内容：视频类播放视频，图文类刷真实图文 ---------------- */

const videoMods = import.meta.glob<string>('/src/assets/videos/cloud-phone-wall/*.mp4', { eager: true, import: 'default', query: '?url' })
const imageMods = import.meta.glob<string>('/src/assets/images/cloud-phone/feed/*.jpg', { eager: true, import: 'default' })
const VIDEOS = Object.keys(videoMods).sort().map(k => videoMods[k])
const IMAGES = Object.keys(imageMods).sort().map(k => imageMods[k])
const at = <T,>(list: T[], i: number) => list[((i % list.length) + list.length) % list.length]

type AppKind = 'short' | 'player' | 'feed' | 'chat' | 'music'
const KIND: Record<string, AppKind> = {
  tiktok: 'short',
  netflix: 'player', primevideo: 'player', disney: 'player', hulu: 'player', twitch: 'player',
  instagram: 'feed', facebook: 'feed', spotify: 'music',
  whatsapp: 'chat', telegram: 'chat', claude: 'chat',
}
const kind = computed<AppKind>(() => (openApp.value && KIND[openApp.value.id]) || 'feed')

const USERS = ['travel.daily', 'nature_escape', 'mia.wanders', 'leo.visuals', 'autumn.mood', 'coastlines', 'wild.frames', 'sunset.club']
const CAPTIONS = [
  'Golden hour by the cliffs 🌅 #travel',
  'Autumn roads are my favourite roads 🍂',
  'Found the calmest lake today 💙',
  'Weekend escape, no signal, no stress',
  'This view never gets old ✨ #scenery',
  'Flowers everywhere this spring 🌼',
  'Dance practice before the show 🔥',
  'Clouds rolling over the grassland ☁️',
]
const CHATS = [
  { name: 'Emma', msg: 'See you at 7 then 👋', time: '16:42' },
  { name: 'Design Team', msg: 'Lucas: new mockups are up', time: '16:30' },
  { name: 'Mom', msg: 'Did you eat yet?', time: '15:58' },
  { name: 'Noah', msg: 'Photo', time: '15:21' },
  { name: 'Weekend Trip', msg: 'Sofia: booked the cabin 🎉', time: '14:07' },
  { name: 'Oliver', msg: 'Haha that is great', time: '12:45' },
  { name: 'Ava', msg: 'Voice message (0:12)', time: '11:30' },
  { name: 'Work', msg: 'Meeting moved to 3pm', time: '10:02' },
  { name: 'Liam', msg: 'Thanks!', time: 'Yesterday' },
  { name: 'Grace', msg: 'Sticker', time: 'Yesterday' },
]
const CLAUDE_MSGS = [
  { me: true, text: 'Plan a 3-day trip to the Faroe Islands' },
  { me: false, text: 'Here is a relaxed 3-day plan: Day 1 — Tórshavn old town and the harbour. Day 2 — hike to Drangarnir and the sea stacks. Day 3 — Gásadalur waterfall at sunset.' },
  { me: true, text: 'What should I pack?' },
  { me: false, text: 'Layers! A waterproof jacket, warm fleece, hiking boots and a hat — the weather changes fast.' },
]
const PLAYER_TITLES: Record<string, string> = {
  netflix: 'Nature\'s Edge · S1:E3', primevideo: 'The Long Road', disney: 'Wild Planet', hulu: 'Coastlines', twitch: 'chill_travel · LIVE',
}

/** 每台手机用不同的素材起点，整墙看起来不重复 */
const seed = computed(() => props.offset * 3)
const shortVideos = computed(() => [0, 1, 2].map(i => (i === 0 && props.video) || at(VIDEOS, seed.value + i)))
const playerVideo = computed(() => props.video || at(VIDEOS, seed.value + 1))
const feedPosts = computed(() => Array.from({ length: 6 }, (_, i) => ({
  user: at(USERS, seed.value + i),
  avatar: at(IMAGES, seed.value + i + 5),
  image: at(IMAGES, seed.value + i),
  caption: at(CAPTIONS, seed.value + i),
  likes: `${(((seed.value + i) * 37) % 90) + 3}.${(i * 7) % 10}K`,
})))
/** tint：从封面取的主色，真实 Spotify 播放页背景会随封面变色 */
const SONGS = [
  { title: 'Ocean Drive', artist: 'Luna Bay', playlist: 'Chill Vibes', tint: '#2E5A6E', lyrics: ['Windows down, the city sleeps', 'Salt air on the radio', 'We drive until the morning breaks'] },
  { title: 'Golden Hour', artist: 'The Wanderers', playlist: 'Daily Mix 1', tint: '#7A4E2A', lyrics: ['Sun is low and so are we', 'Every shadow turning gold', 'Stay a little longer here'] },
  { title: 'Autumn Letters', artist: 'Mira Hale', playlist: 'Acoustic Afternoon', tint: '#7A3A2A', lyrics: ['Leaves are falling on the page', 'Words I never sent to you', 'Folded in a paper plane'] },
  { title: 'Northern Lights', artist: 'Kite Avenue', playlist: 'Discover Weekly', tint: '#2F4A7A', lyrics: ['Green across a silver sky', 'Holding breath and holding on', 'Nothing here but you and I'] },
  { title: 'Slow Mornings', artist: 'Ellis Gray', playlist: 'Liked Songs', tint: '#5A4A6E', lyrics: ['Coffee steam and quiet rooms', 'Nowhere that we need to be', 'Let the day come find us soon'] },
]
const song = computed(() => at(SONGS, props.offset))
const songCover = computed(() => at(IMAGES, seed.value + 3))
const queue = computed(() => Array.from({ length: 4 }, (_, i) => ({ ...at(SONGS, props.offset + i + 1), cover: at(IMAGES, seed.value + i + 6) })))
const posters = computed(() => Array.from({ length: 6 }, (_, i) => at(IMAGES, seed.value + i + 2)))
const chats = computed(() => Array.from({ length: 10 }, (_, i) => ({ ...at(CHATS, seed.value + i), avatar: at(IMAGES, seed.value + i), unread: i < 2 ? i + 1 : 0 })))
</script>

<template>
  <div class="android-home relative h-full w-full flex flex-col overflow-hidden select-none text-white">
    <!-- Android 粉紫壁纸 -->
    <img
      :src="androidWallpaper"
      alt=""
      draggable="false"
      class="pointer-events-none absolute inset-0 block h-full w-full object-cover"
      aria-hidden="true"
    >

    <!-- 顶部 Android 状态栏 -->
    <div class="android-home__statusbar relative z-1 flex shrink-0 items-center justify-between">
      <div class="flex items-center gap-[2.2cqw]">
        <span class="font-500 tracking-tight">{{ timeText }}</span>
        <span class="flex items-center gap-[1.3cqw] opacity-85">
          <span class="android-home__notif-dot rounded-full bg-white" />
          <span class="android-home__notif-dot rounded-full bg-white" />
          <span class="android-home__notif-dot rounded-full bg-white/70" />
        </span>
      </div>
      <div class="flex items-center gap-[2cqw] opacity-95">
        <span class="font-500">4G</span>
        <!-- 信号 -->
        <svg class="android-home__stat-ic" viewBox="0 0 14 14" fill="none" aria-hidden="true">
          <path d="M1.5 12L12.5 1.5V12H1.5Z" fill="currentColor" />
        </svg>
        <!-- 电池 -->
        <svg class="android-home__stat-ic" viewBox="0 0 12 14" fill="none" aria-hidden="true">
          <rect x="4" y="1" width="4" height="1.5" rx="0.5" fill="currentColor" />
          <rect x="2.5" y="2.5" width="7" height="10.5" rx="1.2" fill="currentColor" />
        </svg>
      </div>
    </div>

    <!-- 日期显示 -->
    <div class="android-home__date relative z-1 text-center font-400">
      {{ dateText }}
    </div>

    <!-- 弹性留白 -->
    <div class="flex-1" />

    <!-- 主屏幕应用图标区 -->
    <div class="android-home__grid-area relative z-1 flex flex-col">
      <!-- 桌面应用网格：4 列，参照 Pixel 默认 4×N 布局 -->
      <div class="android-home__grid grid grid-cols-4">
        <div v-for="app in gridApps" :key="app.id" class="flex flex-col items-center">
          <img :src="app.icon" :alt="app.name" draggable="false" class="android-home__app-icon block object-cover" :class="{ 'is-tapping': tappingId === app.id }">
          <span class="android-home__app-label">{{ app.name }}</span>
        </div>
      </div>

      <!-- Dock 栏：无文字标签 -->
      <div class="android-home__dock grid grid-cols-4">
        <div v-for="app in dockRow" :key="app.id" class="flex flex-col items-center">
          <img :src="app.icon" :alt="app.name" draggable="false" class="android-home__app-icon block object-cover" :class="{ 'is-tapping': tappingId === app.id }">
        </div>
      </div>

      <!-- Google 搜索胶囊条 -->
      <div class="android-home__search mt-[5cqw] flex items-center justify-between rounded-full bg-white/95 shadow-sm">
        <svg class="android-home__search-ic" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M20.5 12.2C20.5 11.5 20.4 10.9 20.3 10.3H12V13.8H16.8C16.6 14.9 15.9 15.9 14.9 16.5V18.8H17.9C19.6 17.2 20.5 14.9 20.5 12.2Z" fill="#4285F4" />
          <path d="M12 21C14.4 21 16.4 20.2 17.9 18.8L14.9 16.5C14.1 17 13.1 17.4 12 17.4C9.7 17.4 7.8 15.8 7.1 13.7H4V16.1C5.5 19 8.5 21 12 21Z" fill="#34A853" />
          <path d="M7.1 13.7C6.9 13.2 6.8 12.6 6.8 12C6.8 11.4 6.9 10.8 7.1 10.3V7.9H4C3.3 9.2 3 10.6 3 12C3 13.4 3.3 14.8 4 16.1L7.1 13.7Z" fill="#FBBC05" />
          <path d="M12 6.6C13.3 6.6 14.5 7 15.4 7.9L18 5.3C16.4 3.9 14.4 3 12 3C8.5 3 5.5 5 4 7.9L7.1 10.3C7.8 8.2 9.7 6.6 12 6.6Z" fill="#EA4335" />
        </svg>
        <svg class="android-home__search-ic" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect x="9.5" y="4" width="5" height="10" rx="2.5" fill="#4285F4" />
          <path d="M6.8 11.5A5.2 5.2 0 0 0 17.2 11.5" stroke="#EA4335" stroke-width="2" stroke-linecap="round" />
          <path d="M12 16.8V20" stroke="#34A853" stroke-width="2" stroke-linecap="round" />
        </svg>
      </div>
    </div>

    <!-- 模拟打开的 APP：启动页 → APP 内界面（滚动后停住） -->
    <Transition name="android-app">
      <div
        v-if="openApp"
        class="android-home__app-open absolute inset-0 z-2 overflow-hidden"
        :class="{ 'is-light': theme.light }"
        :style="{ background: phase === 'splash' ? theme.splash : theme.bg, '--accent': accent }"
      >
        <!-- 启动页 -->
        <div
          class="android-home__splash absolute inset-0 flex flex-col items-center justify-center"
          :class="{ 'is-hidden': phase !== 'splash' }"
        >
          <img :src="openApp.icon" :alt="openApp.name" draggable="false" class="android-home__splash-icon block object-cover">
        </div>

        <!-- APP 内界面 -->
        <div class="android-home__inapp absolute inset-0 flex flex-col" :class="{ 'is-visible': phase === 'app' }">
          <div v-if="kind !== 'music'" class="android-home__inapp-bar flex shrink-0 items-center">
            <img :src="openApp.icon" alt="" draggable="false" class="android-home__inapp-logo block object-cover">
            <span class="android-home__inapp-title font-700">{{ openApp.name }}</span>
            <span class="flex-1" />
            <span class="android-home__inapp-dot" />
            <span class="android-home__inapp-dot" />
          </div>
          <div class="relative min-h-0 flex-1 overflow-hidden">
            <!-- 短视频：全屏竖视频，上滑切到下一条 -->
            <div v-if="kind === 'short'" class="android-home__shorts absolute inset-0" :class="`is-step-${scrollStep}`">
              <div v-for="(src, i) in shortVideos" :key="i" class="android-home__short">
                <video v-if="phase === 'app' && Math.abs(i - scrollStep) <= 1" :src="videoSrc(src)" class="absolute inset-0 h-full w-full object-cover" :autoplay="playVideo" :preload="playVideo ? 'auto' : 'metadata'" muted loop playsinline />
                <div class="android-home__short-side">
                  <span v-for="c in ['♥', '💬', '↗']" :key="c" class="android-home__short-act">{{ c }}</span>
                </div>
                <div class="android-home__short-cap">
                  <b>@{{ USERS[(seed + i) % USERS.length] }}</b>
                  <span>{{ CAPTIONS[(seed + i) % CAPTIONS.length] }}</span>
                </div>
              </div>
            </div>

            <!-- 长视频 / 直播：顶部播放器 + 下方推荐列表 -->
            <div v-else-if="kind === 'player'" class="absolute inset-0 flex flex-col">
              <div class="android-home__player relative shrink-0">
                <video v-if="phase === 'app'" :src="videoSrc(playerVideo)" class="absolute inset-0 h-full w-full object-cover" :autoplay="playVideo" :preload="playVideo ? 'auto' : 'metadata'" muted loop playsinline />
                <span v-if="openApp.id === 'twitch'" class="android-home__live">LIVE</span>
                <span class="android-home__progress"><i /></span>
              </div>
              <div class="android-home__player-title font-700">{{ PLAYER_TITLES[openApp.id] }}</div>
              <div class="min-h-0 flex-1 overflow-hidden">
                <div class="android-home__feed" :class="`is-step-${scrollStep}`">
                  <div v-for="row in 3" :key="row" class="android-home__row">
                    <div class="android-home__row-title font-600">{{ ['Continue watching', 'Trending now', 'Because you watched'][row - 1] }}</div>
                    <div class="flex gap-[2.4cqw]">
                      <img v-for="(src, i) in posters.slice(row - 1, row + 2)" :key="i" :src="src" alt="" draggable="false" class="android-home__poster">
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- 音乐播放：参照 Spotify Android「正在播放」页 -->
            <div
              v-else-if="kind === 'music'"
              class="android-home__music absolute inset-0 overflow-hidden"
              :class="{ 'is-playing': phase === 'app' }"
              :style="{ '--tint': song.tint }"
            >
              <div class="android-home__feed" :class="`is-step-${Math.min(scrollStep, 2)}`">
                <!-- 顶栏：收起箭头 / 播放来源 / 更多 -->
                <div class="android-home__np-head flex items-center justify-between">
                  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /></svg>
                  <div class="min-w-0 text-center">
                    <span class="android-home__np-from block">PLAYING FROM PLAYLIST</span>
                    <b class="block truncate">{{ song.playlist }}</b>
                  </div>
                  <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.8" fill="currentColor" /><circle cx="12" cy="12" r="1.8" fill="currentColor" /><circle cx="19" cy="12" r="1.8" fill="currentColor" /></svg>
                </div>

                <img :src="songCover" alt="" draggable="false" class="android-home__cover">

                <!-- 歌名 / 歌手 + 已收藏（绿色对勾） -->
                <div class="android-home__song flex items-center justify-between">
                  <div class="min-w-0">
                    <b class="block truncate">{{ song.title }}</b>
                    <span class="block truncate">{{ song.artist }}</span>
                  </div>
                  <span class="android-home__saved">
                    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M7.5 12.3l3 3 6-6.3" stroke="#000" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" /></svg>
                  </span>
                </div>

                <!-- 进度条（带拖动圆点） -->
                <div class="android-home__bar"><i><b /></i></div>
                <div class="android-home__times flex justify-between"><span>1:12</span><span>-2:16</span></div>

                <div class="android-home__controls flex items-center justify-between">
                  <span class="android-home__ctl is-active">
                    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M4 7h3.5c2 0 3.2 1 4.3 2.8l.4.7M4 17h3.5c2 0 3.2-1 4.3-2.8l2.4-4.4C15.3 8 16.5 7 18.5 7H20M17.5 4.5 20 7l-2.5 2.5M14.6 15.5c1 1 2 1.5 3.9 1.5H20M17.5 14.5 20 17l-2.5 2.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
                    </svg>
                  </span>
                  <span class="android-home__ctl is-big">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M6 5v14" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" />
                      <path d="M19 5.8v12.4a.8.8 0 0 1-1.2.7L8.6 12.7a.8.8 0 0 1 0-1.4l9.2-6.2a.8.8 0 0 1 1.2.7Z" fill="currentColor" />
                    </svg>
                  </span>
                  <span class="android-home__play">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <rect x="6.5" y="5" width="3.8" height="14" rx="1" fill="currentColor" />
                      <rect x="13.7" y="5" width="3.8" height="14" rx="1" fill="currentColor" />
                    </svg>
                  </span>
                  <span class="android-home__ctl is-big">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M18 5v14" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" />
                      <path d="M5 5.8v12.4a.8.8 0 0 0 1.2.7l9.2-6.2a.8.8 0 0 0 0-1.4L6.2 5.1A.8.8 0 0 0 5 5.8Z" fill="currentColor" />
                    </svg>
                  </span>
                  <span class="android-home__ctl">
                    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M5 12V9.5A2.5 2.5 0 0 1 7.5 7H19M16 4l3 3-3 3M19 12v2.5a2.5 2.5 0 0 1-2.5 2.5H5M8 20l-3-3 3-3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
                    </svg>
                  </span>
                </div>

                <!-- 底部小工具：连接设备 / 分享 / 播放队列 -->
                <div class="android-home__np-tools flex items-center justify-between">
                  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3" y="5" width="12" height="10" rx="1.5" stroke="currentColor" stroke-width="1.7" /><rect x="17" y="8" width="4" height="11" rx="1" stroke="currentColor" stroke-width="1.7" /><path d="M7 19h4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" /></svg>
                  <span class="flex items-center gap-[5cqw]">
                    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 4v11M8 8l4-4 4 4M5 13v6h14v-6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" /></svg>
                    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 6h12M4 11h12M4 16h7M16 14v6l4-3-4-3Z" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" /></svg>
                  </span>
                </div>

                <!-- 下滑后出现：歌词卡片 + 关于艺人 -->
                <div class="android-home__lyrics">
                  <b class="android-home__card-title">Lyrics preview</b>
                  <p v-for="(line, i) in song.lyrics" :key="i" :class="{ 'is-current': i === 0 }">{{ line }}</p>
                </div>
                <div class="android-home__artist">
                  <img :src="queue[0].cover" alt="" draggable="false">
                  <div class="android-home__artist-body">
                    <b class="android-home__card-title">About the artist</b>
                    <b class="block">{{ song.artist }}</b>
                    <span class="block">2.4M monthly listeners</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- 聊天类 -->
            <div v-else-if="kind === 'chat'" class="absolute inset-0 overflow-hidden">
              <div v-if="openApp.id === 'claude'" class="android-home__feed android-home__claude" :class="`is-step-${scrollStep}`">
                <div v-for="(m, i) in CLAUDE_MSGS" :key="i" class="android-home__bubble" :class="{ 'is-me': m.me }">{{ m.text }}</div>
              </div>
              <div v-else class="android-home__feed" :class="`is-step-${scrollStep}`">
                <div v-for="(c, i) in chats" :key="i" class="android-home__chat flex items-center">
                  <img :src="c.avatar" alt="" draggable="false" class="android-home__chat-avatar">
                  <div class="min-w-0 flex-1">
                    <div class="flex items-center justify-between"><b class="truncate">{{ c.name }}</b><small>{{ c.time }}</small></div>
                    <div class="flex items-center justify-between gap-[2cqw]"><span class="truncate opacity-60">{{ c.msg }}</span><i v-if="c.unread" class="android-home__badge">{{ c.unread }}</i></div>
                  </div>
                </div>
              </div>
            </div>

            <!-- 图文信息流 -->
            <div v-else class="android-home__feed" :class="`is-step-${scrollStep}`">
              <div v-for="(post, i) in feedPosts" :key="i" class="android-home__post">
                <div class="flex items-center">
                  <img :src="post.avatar" alt="" draggable="false" class="android-home__avatar object-cover">
                  <b class="android-home__post-user truncate">{{ post.user }}</b>
                </div>
                <img :src="post.image" alt="" draggable="false" class="android-home__media object-cover" :class="`is-v${i % 3}`">
                <div class="android-home__post-meta"><b>{{ post.likes }} likes</b></div>
                <div class="android-home__post-cap"><b>{{ post.user }}</b> {{ post.caption }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>

    <!-- 底部 Android 导航栏 -->
    <div class="android-home__navbar relative z-1 flex shrink-0 items-center justify-around bg-[#220931]/55">
      <!-- 音量 - -->
      <svg class="android-home__nav-ic opacity-75" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M3 6.5H5.5L8.8 3.8V12.2L5.5 9.5H3V6.5Z" fill="currentColor" />
      </svg>
      <!-- 返回 -->
      <svg class="android-home__nav-ic" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M10.5 3.5L4.5 8L10.5 12.5V3.5Z" fill="currentColor" />
      </svg>
      <!-- Home -->
      <svg class="android-home__nav-ic" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <circle cx="8" cy="8" r="4.2" fill="currentColor" />
      </svg>
      <!-- 多任务 -->
      <svg class="android-home__nav-ic" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <rect x="4" y="4" width="8" height="8" rx="1.4" fill="currentColor" />
      </svg>
      <!-- 音量 + -->
      <svg class="android-home__nav-ic opacity-75" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M2.5 6.5H5L8.2 3.8V12.2L5 9.5H2.5V6.5Z" fill="currentColor" />
        <path d="M10.8 5.6C11.9 6.7 11.9 9.3 10.8 10.4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" />
      </svg>
    </div>
  </div>
</template>

<style scoped>
.android-home {
  container-type: inline-size;
}

.android-home__statusbar {
  padding: 2.8cqw 4.8cqw 0;
  font-size: 4.5cqw;
  line-height: 1.2;
}

.android-home__notif-dot {
  width: 2cqw;
  height: 2cqw;
}

.android-home__stat-ic {
  width: 4.2cqw;
  height: 4.2cqw;
}

.android-home__date {
  margin-top: 9.5cqw;
  font-size: 7.4cqw;
  line-height: 1.2;
  text-shadow: 0 1px 4px rgba(80, 30, 80, 0.16);
}

.android-home__grid-area {
  padding: 0 4.8cqw 4.5cqw;
}

.android-home__grid {
  row-gap: 5cqw;
}

.android-home__dock {
  margin-top: 8cqw;
}

.android-home__app-icon {
  width: 14cqw;
  height: 14cqw;
  border-radius: 22%;
  transition: transform 0.18s ease, filter 0.18s ease;
}

.android-home__app-icon.is-tapping {
  transform: scale(0.86);
  filter: brightness(0.82);
}

.android-home__splash-icon {
  width: 24cqw;
  height: 24cqw;
  border-radius: 22%;
}

.android-home__app-open {
  color: #fff;
  transition: background-color 0.3s ease;
  --line: rgba(255, 255, 255, 0.16);
  --card: rgba(255, 255, 255, 0.08);
}

.android-home__app-open.is-light {
  color: #1f1f1f;
  --line: rgba(0, 0, 0, 0.1);
  --card: rgba(0, 0, 0, 0.05);
}

.android-home__splash {
  transition: opacity 0.25s ease;
}

.android-home__splash.is-hidden {
  opacity: 0;
}

.android-home__inapp {
  padding-top: 9cqw;
  opacity: 0;
  transition: opacity 0.3s ease;
}

.android-home__inapp.is-visible {
  opacity: 1;
}

.android-home__inapp-bar {
  gap: 2.4cqw;
  padding: 2.5cqw 4.5cqw 3.5cqw;
}

.android-home__inapp-logo {
  width: 7cqw;
  height: 7cqw;
  border-radius: 22%;
}

.android-home__inapp-title {
  font-size: 5cqw;
}

.android-home__inapp-dot {
  width: 5.5cqw;
  height: 5.5cqw;
  border-radius: 50%;
  background: var(--line);
}

.android-home__feed {
  padding: 0 4.5cqw;
  transition: transform 1.5s cubic-bezier(0.25, 0.75, 0.3, 1);
}

.android-home__feed.is-step-1 {
  transform: translateY(-70cqw);
}

.android-home__feed.is-step-2 {
  transition-duration: 1.3s;
  transform: translateY(-150cqw);
}

.android-home__post {
  display: flex;
  flex-direction: column;
  gap: 2.2cqw;
  padding-bottom: 6cqw;
}

.android-home__avatar {
  width: 7cqw;
  height: 7cqw;
  margin-right: 2.4cqw;
  border-radius: 50%;
}

.android-home__post-user,
.android-home__post-meta,
.android-home__post-cap {
  font-size: 3.4cqw;
  line-height: 1.35;
}

.android-home__post-cap {
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  opacity: 0.85;
}

.android-home__media {
  display: block;
  width: 100%;
  height: 60cqw;
  border-radius: 2cqw;
}

.android-home__media.is-v1 { height: 48cqw; }
.android-home__media.is-v2 { height: 72cqw; }

/* 短视频 */
.android-home__shorts {
  transition: transform 0.6s cubic-bezier(0.3, 0.8, 0.3, 1);
}

.android-home__shorts.is-step-1 { transform: translateY(-100%); }
.android-home__shorts.is-step-2 { transform: translateY(-200%); }

.android-home__short {
  position: relative;
  height: 100%;
  overflow: hidden;
  background: #111;
}

.android-home__short-side {
  position: absolute;
  right: 3cqw;
  bottom: 24cqw;
  display: flex;
  flex-direction: column;
  gap: 4cqw;
}

.android-home__short-act {
  display: flex;
  width: 9cqw;
  height: 9cqw;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.35);
  font-size: 4.4cqw;
}

.android-home__short-cap {
  position: absolute;
  left: 4cqw;
  right: 16cqw;
  bottom: 6cqw;
  display: flex;
  flex-direction: column;
  gap: 1cqw;
  font-size: 3.5cqw;
  line-height: 1.3;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.6);
}

/* 长视频 / 直播 */
.android-home__player {
  width: 100%;
  aspect-ratio: 16 / 9;
  overflow: hidden;
  background: #000;
}

.android-home__live {
  position: absolute;
  left: 3cqw;
  top: 3cqw;
  padding: 0.6cqw 1.8cqw;
  border-radius: 1cqw;
  background: #eb0400;
  font-size: 3cqw;
  font-weight: 700;
}

.android-home__progress {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 0.8cqw;
  background: rgba(255, 255, 255, 0.25);
}

.android-home__progress i {
  display: block;
  width: 38%;
  height: 100%;
  background: var(--accent);
}

.android-home__player-title {
  padding: 3cqw 4.5cqw 1cqw;
  font-size: 4.2cqw;
}

.android-home__row {
  padding-top: 4cqw;
}

.android-home__row-title {
  margin-bottom: 2cqw;
  font-size: 3.6cqw;
}

.android-home__poster {
  display: block;
  width: calc((100% - 4.8cqw) / 3);
  aspect-ratio: 2 / 3;
  border-radius: 1.6cqw;
  object-fit: cover;
}

/* 音乐播放（Spotify 正在播放页） */
.android-home__music {
  color: #fff;
  background: linear-gradient(180deg, color-mix(in srgb, var(--tint) 92%, #fff 0%) 0%, color-mix(in srgb, var(--tint) 55%, #121212) 55%, #121212 100%);
}

.android-home__music .android-home__feed.is-step-1 { transform: translateY(-40cqw); }
.android-home__music .android-home__feed.is-step-2 { transform: translateY(-95cqw); }

.android-home__np-head {
  gap: 3cqw;
  padding: 1cqw 0 0;
}

.android-home__np-head > svg {
  width: 6cqw;
  height: 6cqw;
  flex-shrink: 0;
}

.android-home__np-head b {
  font-size: 3.4cqw;
  line-height: 1.3;
}

.android-home__np-from {
  font-size: 2.5cqw;
  letter-spacing: 0.08em;
  opacity: 0.75;
}

.android-home__cover {
  display: block;
  width: 100%;
  aspect-ratio: 1;
  margin-top: 8cqw;
  border-radius: 1.5cqw;
  object-fit: cover;
  box-shadow: 0 3cqw 10cqw rgba(0, 0, 0, 0.4);
}

.android-home__song {
  gap: 3cqw;
  margin-top: 8cqw;
  line-height: 1.3;
}

.android-home__song b {
  font-size: 5.2cqw;
}

.android-home__song span {
  font-size: 3.8cqw;
  color: rgba(255, 255, 255, 0.7);
}

.android-home__saved {
  display: flex;
  width: 6.4cqw;
  height: 6.4cqw;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: #1ed760;
}

.android-home__saved svg {
  width: 72%;
  height: 72%;
}

.android-home__bar {
  height: 1cqw;
  margin-top: 5cqw;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.3);
}

.android-home__bar i {
  position: relative;
  display: block;
  width: 34%;
  height: 100%;
  border-radius: inherit;
  background: #fff;
}

.android-home__bar b {
  position: absolute;
  right: -1.5cqw;
  top: 50%;
  width: 3cqw;
  height: 3cqw;
  border-radius: 50%;
  background: #fff;
  transform: translateY(-50%);
}

.android-home__music.is-playing .android-home__bar i {
  animation: android-music-progress 30s linear forwards;
}

@keyframes android-music-progress {
  from { width: 34%; }
  to { width: 52%; }
}

.android-home__times {
  margin-top: 2cqw;
  font-size: 2.8cqw;
  color: rgba(255, 255, 255, 0.7);
}

.android-home__controls {
  margin-top: 2cqw;
  color: #fff;
}

.android-home__ctl {
  position: relative;
  display: flex;
  width: 6.4cqw;
  height: 6.4cqw;
  align-items: center;
  justify-content: center;
}

.android-home__ctl svg {
  width: 100%;
  height: 100%;
}

.android-home__ctl.is-big {
  width: 8.5cqw;
  height: 8.5cqw;
}

.android-home__ctl.is-active {
  color: #1ed760;
}

.android-home__ctl.is-active::after {
  content: '';
  position: absolute;
  bottom: -2cqw;
  width: 1cqw;
  height: 1cqw;
  border-radius: 50%;
  background: currentColor;
}

.android-home__play {
  display: flex;
  width: 16cqw;
  height: 16cqw;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: #fff;
  color: #000;
}

.android-home__play svg {
  width: 42%;
  height: 42%;
}

.android-home__np-tools {
  margin-top: 4cqw;
  color: rgba(255, 255, 255, 0.85);
}

.android-home__np-tools svg {
  width: 5cqw;
  height: 5cqw;
}

.android-home__card-title {
  display: block;
  margin-bottom: 2.4cqw;
  font-size: 3.8cqw;
}

.android-home__lyrics {
  margin-top: 8cqw;
  padding: 4cqw;
  border-radius: 2.4cqw;
  background: color-mix(in srgb, var(--tint) 80%, #fff 8%);
}

.android-home__lyrics p {
  margin: 0 0 1.6cqw;
  font-size: 4.6cqw;
  font-weight: 700;
  line-height: 1.3;
  color: rgba(0, 0, 0, 0.55);
}

.android-home__lyrics p.is-current {
  color: #fff;
}

.android-home__artist {
  margin-top: 4cqw;
  overflow: hidden;
  border-radius: 2.4cqw;
  background: #242424;
}

.android-home__artist img {
  display: block;
  width: 100%;
  height: 34cqw;
  object-fit: cover;
}

.android-home__artist-body {
  padding: 3.4cqw 4cqw 4cqw;
  font-size: 3.4cqw;
  line-height: 1.4;
}

.android-home__artist-body span {
  color: rgba(255, 255, 255, 0.7);
}

/* 聊天 */
.android-home__chat {
  gap: 3cqw;
  padding: 2.6cqw 0;
  font-size: 3.5cqw;
  line-height: 1.35;
}

.android-home__chat small {
  flex-shrink: 0;
  font-size: 2.8cqw;
  opacity: 0.5;
}

.android-home__chat-avatar {
  width: 11cqw;
  height: 11cqw;
  flex-shrink: 0;
  border-radius: 50%;
  object-fit: cover;
}

.android-home__badge {
  display: flex;
  min-width: 4.6cqw;
  height: 4.6cqw;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: var(--accent);
  color: #fff;
  font-size: 2.8cqw;
  font-style: normal;
}

.android-home__claude {
  display: flex;
  flex-direction: column;
  gap: 3cqw;
  padding-top: 2cqw;
}

.android-home__bubble {
  max-width: 86%;
  font-size: 3.6cqw;
  line-height: 1.45;
}

.android-home__bubble.is-me {
  align-self: flex-end;
  padding: 2.4cqw 3.4cqw;
  border-radius: 3.5cqw;
  background: rgba(0, 0, 0, 0.07);
}

.android-app-enter-active {
  transition: transform 0.32s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.22s ease-out;
}

.android-app-leave-active {
  transition: transform 0.26s ease-in, opacity 0.26s ease-in;
}

.android-app-enter-from,
.android-app-leave-to {
  opacity: 0;
  transform: scale(0.82);
}

.android-home__app-label {
  margin-top: 1.8cqw;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 3.4cqw;
  line-height: 1.2;
  color: rgba(255, 255, 255, 0.94);
  text-shadow: 0 1px 2px rgba(40, 10, 50, 0.35);
}

.android-home__caret {
  width: 4cqw;
  height: 2.6cqw;
}

.android-home__search {
  height: 12.5cqw;
  padding: 0 4.2cqw;
}

.android-home__search-ic {
  width: 6.2cqw;
  height: 6.2cqw;
}

.android-home__navbar {
  height: 11.5cqw;
  padding: 0 8cqw;
}

.android-home__nav-ic {
  width: 5.5cqw;
  height: 5.5cqw;
}
</style>
