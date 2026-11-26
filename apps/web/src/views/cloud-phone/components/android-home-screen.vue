<script setup lang="ts">
import androidWallpaper from '/@/assets/images/cloud-phone/android-blue-wallpaper.jpg'
import { storeApps } from '../app-store-catalog'

/**
 * 模拟 Android 云手机桌面组件
 * 基于容器宽度（cqw）等比例缩放，在左侧大屏、右侧小屏及放大灯箱中均可高清无损呈现。
 */
import { computed, h, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import type { FunctionalComponent } from 'vue'
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
  /** 循环演示：滚动完不停，回到桌面再依次打开下一个 APP（左侧主屏用） */
  loop?: boolean
  /** 循环时每个 APP 额外停留的时长（毫秒），右侧小屏用来放慢节奏 */
  loopPause?: number
}>(), {
  timeText: undefined,
  dateText: undefined,
  autoplay: false,
  offset: 0,
  playVideo: true,
  loop: false,
  loopPause: 0,
})

/** 状态栏时间、桌面日期：默认取当前时间，每 30 秒刷新 */
const now = ref(new Date())
const clockTimer = setInterval(() => (now.value = new Date()), 30_000)
onBeforeUnmount(() => clearInterval(clockTimer))
const clockTime = computed(() => props.timeText || now.value.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }))
const clockDate = computed(() => props.dateText || now.value.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }))

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
  facebook: { splash: '#ffffff', bg: '#ffffff', light: true },
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
/** APP 内的实时动作计数：直播弹幕、聊天「正在输入」、Claude 逐字输出 */
const chatCount = ref(0)
/** APP 内的点击高亮（Spotify 点歌单、Telegram 点会话） */
const innerTap = ref(false)
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
  chatCount.value = 0
  innerTap.value = false
}

/** 演示：点开一个 APP → 启动页 → 进入后滚动两段。
 *  loop 模式下停留几秒后回到桌面，再点开下一个 APP，一直循环 */
function playApp(index: number, startAt: number) {
  const app = allApps[index % allApps.length]
  const isShort = app.id === 'tiktok'
  /** Spotify / Telegram：先停在首页（列表），再点进播放页（对话） */
  const isTg = app.id === 'telegram'
  const twoPage = isTg || app.id === 'spotify'
  let t = startAt
  later(() => (tappingId.value = app.id), t)
  t += TIMING.tap
  later(() => {
    tappingId.value = null
    chatCount.value = 0
    scrollStep.value = 0
    innerTap.value = false
    openApp.value = app
    phase.value = 'splash'
  }, t)
  t += TIMING.splash
  later(() => (phase.value = 'app'), t)
  for (let k = 1; k <= 14; k++) {
    later(() => chatCount.value++, t + k * 850)
  }
  // 短视频先看一会儿再上滑
  t += isShort ? 5200 : isTg ? 4300 : twoPage ? 2600 : TIMING.beforeScroll
  if (twoPage) {
    later(() => (innerTap.value = true), t - 450)
  }
  later(() => {
    innerTap.value = false
    scrollStep.value = 1
  }, t)
  t += (isShort ? 4200 : twoPage ? 3000 : TIMING.scroll1) + TIMING.hold
  later(() => (scrollStep.value = 2), t)
  if (!props.loop) {
    return
  }
  t += (isShort ? 4200 : twoPage ? 4600 : 3600) + props.loopPause
  later(() => {
    openApp.value = null
    phase.value = 'home'
    scrollStep.value = 0
  }, t)
  t += 1100 + Math.round(props.loopPause / 4)
  later(() => {
    timers.length = 0
    playApp(index + 1, 0)
  }, t)
}

function play() {
  playApp(props.offset, 500 + (props.offset % 7) * 260) // 错开每台手机的起始时间
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

type AppKind = 'short' | 'music' | 'instagram' | 'facebook' | 'whatsapp' | 'telegram' | 'claude' | 'stream' | 'live'
const KIND: Record<string, AppKind> = {
  tiktok: 'short',
  spotify: 'music',
  instagram: 'instagram',
  facebook: 'facebook',
  whatsapp: 'whatsapp',
  telegram: 'telegram',
  claude: 'claude',
  twitch: 'live',
  netflix: 'stream',
  disney: 'stream',
  primevideo: 'stream',
  hulu: 'stream',
}
const kind = computed<AppKind>(() => (openApp.value && KIND[openApp.value.id]) || 'instagram')
/** 指定了视频（如第一个大窗口）就一直停在这条，不再上滑切走 */
const shortStep = computed(() => (props.video && !props.loop ? 0 : scrollStep.value))

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
const SHORT_ACTIONS = [
  { key: 'like', count: '128K', d: 'M12 21s-8.5-5.2-8.5-11.4A4.9 4.9 0 0 1 12 6.4a4.9 4.9 0 0 1 8.5 3.2C20.5 15.8 12 21 12 21Z' },
  { key: 'comment', count: '1,024', d: 'M12 3.5c4.9 0 8.8 3.4 8.8 7.6s-3.9 7.6-8.8 7.6c-.9 0-1.8-.1-2.6-.3L5 20.3l1.1-3.6c-1.8-1.4-2.9-3.4-2.9-5.6 0-4.2 3.9-7.6 8.8-7.6Z' },
  { key: 'save', count: '9,872', d: 'M7 3.5h10a1.5 1.5 0 0 1 1.5 1.5v15.5L12 16.6l-6.5 3.9V5A1.5 1.5 0 0 1 7 3.5Z' },
  { key: 'share', count: '2,301', d: 'M13.5 4.5 21 11.5l-7.5 7v-4.2c-5 0-8.3 1.6-10.5 5.2.8-5.4 3.8-10 10.5-10.9V4.5Z' },
]
const shortVideos = computed(() => [0, 1, 2].map(i => (i === 0 && props.video) || at(VIDEOS, seed.value + i)))
const playerVideo = computed(() => props.video || at(VIDEOS, seed.value + 1))
const feedPosts = computed(() => Array.from({ length: 6 }, (_, i) => ({
  user: at(USERS, seed.value + i),
  avatar: at(IMAGES, seed.value + i + 5),
  image: at(IMAGES, seed.value + i),
  caption: at(CAPTIONS, seed.value + i),
  likes: `${(((seed.value + i) * 37) % 90) + 3}.${(i * 7) % 10}K`,
})))
/** Spotify 歌曲：封面为专门生成的专辑封面，tint 取自封面主色（真实 Spotify 播放页背景随封面变色） */
const coverMods = import.meta.glob<string>('/src/assets/images/cloud-phone/music/*.jpg', { eager: true, import: 'default' })
const cover = (name: string) => coverMods[`/src/assets/images/cloud-phone/music/${name}.jpg`]
const SONGS = [
  { title: 'Ocean Drive', artist: 'Luna Bay', playlist: 'Chill Vibes', cover: cover('ocean-drive'), tint: '#1F7F7B', dur: 208, lyrics: ['Windows down, the city sleeps', 'Salt air on the radio', 'We drive until the morning breaks'] },
  { title: 'Golden Hour', artist: 'The Wanderers', playlist: 'Daily Mix 1', cover: cover('golden-hour'), tint: '#8F5B23', dur: 231, lyrics: ['Sun is low and so are we', 'Every shadow turning gold', 'Stay a little longer here'] },
  { title: 'Autumn Letters', artist: 'Mira Hale', playlist: 'Acoustic Afternoon', cover: cover('autumn-letters'), tint: '#8E2427', dur: 197, lyrics: ['Leaves are falling on the page', 'Words I never sent to you', 'Folded in a paper plane'] },
  { title: 'Northern Lights', artist: 'Kite Avenue', playlist: 'Discover Weekly', cover: cover('northern-lights'), tint: '#22437F', dur: 244, lyrics: ['Green across a silver sky', 'Holding breath and holding on', 'Nothing here but you and I'] },
  { title: 'Slow Mornings', artist: 'Ellis Gray', playlist: 'Liked Songs', cover: cover('slow-mornings'), tint: '#76608A', dur: 186, lyrics: ['Coffee steam and quiet rooms', 'Nowhere that we need to be', 'Let the day come find us soon'] },
]
/** 播放页不滚动：第二步模拟点「下一首」，换歌、换封面、背景色跟着变 */
const songIdx = computed(() => props.offset + (scrollStep.value >= 2 ? 1 : 0))
const song = computed(() => at(SONGS, songIdx.value))
const songElapsed = computed(() => (scrollStep.value >= 2 ? 3 : 72))
const fmt = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`
const songTimes = computed(() => [fmt(songElapsed.value), `-${fmt(song.value.dur - songElapsed.value)}`])
const songPct = computed(() => `${Math.round((songElapsed.value / song.value.dur) * 100)}%`)
const nextSong = computed(() => at(SONGS, songIdx.value + 1))

/** Spotify 首页（参照用户手机截图）：快捷方式 2 列网格 + Jump back in + Made For You + 迷你播放条 */
const spTiles = computed(() => [
  { t: song.value.title, img: song.value.cover, playing: true },
  { t: 'Liked Songs', liked: true },
  { t: 'Luna Bay', img: at(IMAGES, seed.value + 2), round: true },
  { t: 'Discover Weekly', img: cover('northern-lights') },
  { t: 'Mira Hale', img: at(IMAGES, seed.value + 5), round: true },
  { t: 'Golden Hour Radio', img: cover('golden-hour') },
  { t: 'Daily Mix 4', img: cover('autumn-letters') },
  { t: 'lofi chill', img: cover('slow-mornings') },
])
const spJump = computed(() => [
  { t: 'Acoustic Afternoon', sub: 'Playlist · Spotify', img: at(IMAGES, seed.value + 1) },
  { t: 'Chill Vibes', sub: 'Playlist · Spotify', img: cover('ocean-drive') },
  { t: 'Autumn Letters', sub: 'Album · Mira Hale', img: cover('autumn-letters') },
  { t: 'Night Drive', sub: 'Playlist · Spotify', img: at(IMAGES, seed.value + 8) },
])
const spMixes = computed(() => [1, 2, 3, 4].map(n => ({
  t: `Daily Mix ${n}`,
  sub: ['Luna Bay, Kite Avenue and more', 'Mira Hale, Ellis Gray and more', 'The Wanderers, Luna Bay and more', 'Kite Avenue, Mira Hale and more'][n - 1],
  img: [cover('northern-lights'), cover('golden-hour'), cover('slow-mornings'), at(IMAGES, seed.value + 3)][n - 1],
  color: ['#E8115B', '#1E3264', '#148A08', '#BA5D07'][n - 1],
})))
const ROW_TITLES = ['Continue watching', 'Trending now', 'Because you watched', 'New releases', 'Top picks for you']
const posters = computed(() => Array.from({ length: 6 }, (_, i) => at(IMAGES, seed.value + i + 2)))
/* ---------------- 各 APP 的真实界面数据 ---------------- */

const STATUS_BG: Record<string, string> = {}

const FB_NAMES = ['Emma Wilson', 'Lucas Martin', 'Travel Daily', 'Mia Chen', 'Nature Escape', 'Leo Garcia', 'Sofia Rossi', 'Noah Kim']
const FB_TIMES = ['2h', '5h', '1d', '3h', '8h', '12m']
const stories = computed(() => Array.from({ length: 6 }, (_, i) => ({
  user: at(USERS, seed.value + i + 1),
  avatar: at(IMAGES, seed.value + i + 2),
  image: at(IMAGES, seed.value + i + 7),
})))
const fbPosts = computed(() => feedPosts.value.map((post, i) => ({
  ...post,
  name: at(FB_NAMES, seed.value + i),
  time: at(FB_TIMES, i),
  comments: ((seed.value + i) * 23) % 300 + 18,
})))

const TG_COLORS = [
  ['#FF885E', '#FF516A'], ['#A0DE7E', '#54CB68'], ['#72D5FD', '#2A9EF1'],
  ['#E0A2F3', '#D669ED'], ['#FFCD6A', '#FFA85C'], ['#53EDD6', '#28C9B7'],
]
/** 与状态栏同一格式的「几分钟前」时间 */
const ago = (min: number) => new Date(now.value.getTime() - min * 60_000).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
/** 参照用户的 iOS Telegram：置顶会话灰底、群聊两行（发送人 + 内容）、静音灰色角标、普通蓝色角标 */
const TG_TYPING_ROW = 3
const tgChats = computed(() => {
  const list = [
    { name: 'Design Team', sender: 'Lucas', msg: 'New mockups are up ✅ – onboarding, pricing page and the cloud phone empty state', time: 'Mon', pinned: true, photo: true },
    { name: 'Travel Deals', msg: '✈️ Singapore → Tokyo from $199. Limited seats this weekend, book before Friday', time: '11/08', pinned: true, muted: true, initials: 'TD' },
    { name: 'Weekend Trip', sender: 'Sofia', msg: 'Booked the cabin 🎉 check-in is 3pm', time: 'Wed', pinned: true, muted: true, unread: '28', initials: 'WT' },
    { name: 'Emma', msg: 'See you at 7 then 👋', time: ago(2), unread: '2', photo: true },
    { name: 'Tech News', sender: 'Kevin', msg: 'Android 17 beta is out, here is what changed in the launcher…', time: ago(3), muted: true, unread: '208', photo: true },
    { name: 'Product Updates', sender: 'Release Bot', msg: '❗ Version 3.2 is rolling out to all regions today', time: ago(9), muted: true, unread: '177', initials: 'PU' },
    { name: 'Design Inspo', sender: 'Mia', msg: '⭐ Sticker', time: ago(170), muted: true, unread: '1.2K', photo: true },
    { name: 'Noah', msg: 'Voice message', time: ago(260), tick: true, photo: true },
    { name: 'Mom', msg: 'Did you eat yet?', time: 'Sun', photo: true },
    { name: 'Oliver', msg: 'Haha that is great', time: 'Sat', initials: 'O' },
  ]
  return list.map((c, i) => {
    const typing = i === TG_TYPING_ROW && chatCount.value > 0 && chatCount.value < 4
    const arrived = i === TG_TYPING_ROW && chatCount.value >= 4
    return {
      ...c,
      typing,
      msg: arrived ? 'On my way! 🚗' : c.msg,
      unread: arrived ? String(Number(c.unread) + 1) : c.unread,
      grad: at(TG_COLORS, seed.value + i),
      avatar: at(IMAGES, seed.value + i),
    }
  })
})
/** 列表里被点开的会话（第 5 行 Tech News，对应用户截图里 208 条未读的群） */
const TG_OPEN_ROW = 4
const TG_SENDERS: Record<string, { color: string, img?: number, initials?: string, grad?: number, tag?: string }> = {
  'Kevin': { color: '#3A8BD6', img: 1 },
  'Lucas': { color: '#3A8BD6', img: 4, tag: 'admin' },
  'Ava': { color: '#D9822B', initials: 'A', grad: 4 },
  'Mia Lopez': { color: '#3A8BD6', initials: 'ML', grad: 2 },
  'Oliver': { color: '#B9437B', initials: 'O', grad: 3 },
  'Noah': { color: '#4CA25A', img: 6 },
}
const RELEASE = 'Release notes: dev.example.com/android-17'
const tgThread = computed(() => {
  const base: { from: string, text: string, time: string, reply?: { from: string, text: string }, replies?: number, img?: string }[] = [
    { from: 'Kevin', reply: { from: 'Lucas', text: RELEASE }, text: 'Does the new launcher still support custom icon packs? Installed the beta but nothing changed', time: ago(21) },
    { from: 'Lucas', text: 'Yes, it does', time: ago(21) },
    { from: 'Lucas', text: 'Working fine on my Pixel', time: ago(21) },
    { from: 'Kevin', text: 'Do I need to reinstall the app?', replies: 2, time: ago(20) },
    { from: 'Ava', reply: { from: 'Lucas', text: RELEASE }, text: 'I\'ll try it', time: ago(4) },
    { from: 'Lucas', reply: { from: 'Kevin', text: 'Do I need to reinstall the app?' }, text: 'Just clear the cache and restart', time: ago(3) },
    { from: 'Mia Lopez', text: 'Is there a device limit?', time: ago(2) },
    { from: 'Oliver', text: '6 devices', replies: 1, time: ago(1) },
  ]
  // 进入对话后陆续收到新消息
  if (chatCount.value >= 10) {
    base.push({ from: 'Noah', img: at(IMAGES, seed.value + 2), text: 'Here is mine after the update 👇', time: ago(0) })
  }
  if (chatCount.value >= 12) {
    base.push({ from: 'Lucas', reply: { from: 'Noah', text: 'Photo' }, text: 'Looks great 🔥', time: ago(0) })
  }
  return base.map((m, i) => {
    const who = TG_SENDERS[m.from]
    return {
      ...m,
      ...who,
      // who.img 是头像序号，不能覆盖消息本身的配图 m.img
      img: m.img,
      first: base[i - 1]?.from !== m.from,
      last: base[i + 1]?.from !== m.from,
      avatar: who.img !== undefined ? at(IMAGES, seed.value + who.img) : undefined,
      gradient: who.grad !== undefined ? at(TG_COLORS, who.grad) : undefined,
      replyColor: m.reply ? TG_SENDERS[m.reply.from].color : undefined,
    }
  })
})
const tgSubtitle = computed(() => (chatCount.value === 9 ? 'Noah is typing…' : '26,707 members, 1,131 online'))

/** 对话页滚动：打开时停在「未读消息」处，第二步滚到底部，新消息进来继续往上推 */
const tgViewport = ref<HTMLElement | null>(null)
const tgThreadEl = ref<HTMLElement | null>(null)
const tgOffset = ref(0)
watch([scrollStep, () => tgThread.value.length, kind], async () => {
  await nextTick()
  if (kind.value !== 'telegram' || scrollStep.value < 2 || !tgViewport.value || !tgThreadEl.value) {
    tgOffset.value = 0
    return
  }
  tgOffset.value = Math.max(0, tgThreadEl.value.offsetHeight - tgViewport.value.clientHeight)
})

/** 底部「聊天」角标：未静音会话的未读数 */
const tgBadge = computed(() => tgChats.value.filter(c => !c.muted && c.unread).reduce((n, c) => n + Number(c.unread), 0))

/** 流媒体首页（Netflix / Disney+ / Prime Video / Hulu） */
type RowType = 'progress' | 'top10' | 'poster' | 'wide'
const STREAM: Record<string, { bg: string, hero: 'tall' | 'wide', title: string, tags: string, chips: string[], rows: { t: string, type: RowType }[], nav: { i: IconName, l: string }[], s1: string, s2: string }> = {
  netflix: {
    bg: '#000000', hero: 'tall', title: 'NATURE\'S EDGE', tags: 'Breathtaking · Nature · Docuseries',
    chips: ['TV Shows', 'Movies', 'Categories'],
    rows: [{ t: 'Continue Watching', type: 'progress' }, { t: 'Top 10 Shows Today', type: 'top10' }, { t: 'Trending Now', type: 'poster' }],
    nav: [{ i: 'home', l: 'Home' }, { i: 'film', l: 'New & Hot' }, { i: 'user', l: 'My Netflix' }],
    s1: '-58cqw', s2: '-118cqw',
  },
  disney: {
    bg: '#1A1D29', hero: 'wide', title: 'Wild Planet', tags: 'New Episodes · Streaming Now',
    chips: [],
    rows: [{ t: 'Recommended For You', type: 'poster' }, { t: 'Continue Watching', type: 'wide' }, { t: 'Trending', type: 'poster' }],
    nav: [{ i: 'home', l: '' }, { i: 'search', l: '' }, { i: 'download', l: '' }, { i: 'user', l: '' }],
    s1: '-40cqw', s2: '-76cqw',
  },
  primevideo: {
    bg: '#0F171E', hero: 'wide', title: 'The Long Road', tags: 'Included with Prime',
    chips: ['Home', 'Movies', 'TV Shows', 'Live TV'],
    rows: [{ t: 'Continue watching', type: 'wide' }, { t: 'Top 10 today', type: 'top10' }, { t: 'Recommended movies', type: 'poster' }],
    nav: [{ i: 'home', l: 'Home' }, { i: 'store', l: 'Store' }, { i: 'search', l: 'Find' }, { i: 'download', l: 'Downloads' }],
    s1: '-40cqw', s2: '-84cqw',
  },
  hulu: {
    bg: '#0B0C0F', hero: 'wide', title: 'Coastlines', tags: 'Hulu Original · New Season',
    chips: ['TV', 'Movies', 'Sports', 'News'],
    rows: [{ t: 'Keep Watching', type: 'wide' }, { t: 'Hulu Originals', type: 'poster' }, { t: 'Trending Now', type: 'poster' }],
    nav: [{ i: 'home', l: 'Home' }, { i: 'search', l: 'Search' }, { i: 'download', l: 'Downloads' }, { i: 'user', l: 'Account' }],
    s1: '-40cqw', s2: '-84cqw',
  },
}
const stream = computed(() => (openApp.value && STREAM[openApp.value.id]) || STREAM.netflix)

/** APP 内导航栏底色：与各 APP 的实际背景一致 */
const navBg = computed(() => {
  if (kind.value === 'stream') {
    return stream.value.bg
  }
  if (kind.value === 'claude') {
    return '#faf9f5'
  }
  if (kind.value === 'music') {
    return scrollStep.value >= 1 ? `color-mix(in srgb, ${song.value.tint} 22%, #0b0b0b)` : '#000'
  }
  if (kind.value === 'telegram') {
    return scrollStep.value >= 1 ? '#9cc595' : '#fff'
  }
  return theme.value.bg
})
const BRANDS = ['Disney', 'Pixar', 'Marvel', 'Star Wars', 'Nat Geo']

/** Twitch 直播弹幕 */
const TWITCH_CHAT = [
  { u: 'pixelfox', c: '#FF7F50', m: 'this view is unreal 😍', b: '#9147FF' },
  { u: 'nomad_kai', c: '#1E90FF', m: 'where is this?' },
  { u: 'chill_travel', c: '#BF94FF', m: 'Faroe Islands today! wind is crazy', b: '#E91916' },
  { u: 'lunawaves', c: '#00C8AF', m: 'the seagull KEKW' },
  { u: 'mapleleaf22', c: '#FFB31A', m: 'first time here, love the vibe' },
  { u: 'driftwood', c: '#FF4A80', m: 'PogChamp' },
  { u: 'skye_runner', c: '#7FD13B', m: 'can you go closer to the cliff?' },
  { u: 'oceanmode', c: '#1E90FF', m: 'that water color 💙' },
  { u: 'StreamElements', c: '#ADADB8', m: 'Follow for daily travel streams ✈️', b: '#00AD03' },
  { u: 'tomatotime', c: '#FF7F50', m: 'what camera are you using?' },
  { u: 'chill_travel', c: '#BF94FF', m: '@tomatotime phone + gimbal 🙂', b: '#E91916' },
  { u: 'nightowl', c: '#00C8AF', m: 'hello from Singapore 🇸🇬' },
  { u: 'pixelfox', c: '#FF7F50', m: '❤️❤️❤️', b: '#9147FF' },
  { u: 'wanderlust', c: '#FFB31A', m: 'adding this to my bucket list' },
  { u: 'kiwi_bird', c: '#7FD13B', m: 'LUL' },
  { u: 'mapleleaf22', c: '#FFB31A', m: 'so peaceful' },
]
const twitchChat = computed(() => TWITCH_CHAT.slice(0, 6 + chatCount.value))
const twitchViewers = computed(() => `${(12.4 + (props.offset % 5) * 1.3).toFixed(1)}K`)

/** Claude：最后一条回复逐字输出 */
const claudeTyped = computed(() => {
  const full = CLAUDE_MSGS[3].text
  return full.slice(0, Math.min(full.length, Math.round((full.length * chatCount.value) / 6)))
})

/* ---------------- 线条图标（Lucide 风格，24×24，描边 2） ---------------- */

const circ = (cx: number, cy: number, r: number) => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${r * 2} 0a${r} ${r} 0 1 0 ${-r * 2} 0Z`
const ICONS = {
  heart: 'M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z',
  comment: 'M7.9 20A9 9 0 1 0 4 16.1L2 22Z',
  send: 'M22 2 11 13M22 2l-7 20-4-9-9-4 20-7Z',
  bookmark: 'm19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z',
  more: circ(12, 5, 1) + circ(12, 12, 1) + circ(12, 19, 1),
  moreH: circ(5, 12, 1) + circ(12, 12, 1) + circ(19, 12, 1),
  home: 'M3 9.5 12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1Z',
  search: `${circ(11, 11, 8)}M21 21l-4.3-4.3`,
  plusSquare: 'M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2ZM8 12h8M12 8v8',
  reels: 'M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2ZM3 8h18M8 3l3 5M14 3l3 5M10 12v5l4-2.5Z',
  plus: 'M12 5v14M5 12h14',
  messenger: 'M12 3c-5 0-9 3.7-9 8.4 0 2.6 1.3 4.9 3.3 6.5V21l3-1.7c.9.3 1.8.4 2.7.4 5 0 9-3.7 9-8.4S17 3 12 3ZM7.5 13.5l3-3.2 2.2 2.2 3.8-2.7-3 3.2-2.2-2.2Z',
  tv: 'M4 7h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2ZM17 2l-5 5-5-5',
  users: `M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2${circ(9, 7, 4)}M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75`,
  store: 'M4 10v10h16V10M3 6l2-3h14l2 3v1.5a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0ZM10 20v-5h4v5',
  bell: 'M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0',
  menu: 'M4 6h16M4 12h16M4 18h16',
  image: `M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z${circ(9, 9, 2)}m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21`,
  globe: `${circ(12, 12, 10)}M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10Z`,
  x: 'M18 6 6 18M6 6l12 12',
  thumb: 'M7 10v12M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z',
  share: 'm15 17 5-5-5-5M4 18v-2a4 4 0 0 1 4-4h12',
  camera: `M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3Z${circ(12, 13, 3)}`,
  phone: 'M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92Z',
  updates: 'M10.1 2.2a10 10 0 0 1 3.8 0M17.6 3.7a10 10 0 0 1 2.7 2.7M21.8 10.1a10 10 0 0 1 0 3.8M20.3 17.6a10 10 0 0 1-2.7 2.7M13.9 21.8a10 10 0 0 1-3.8 0M6.4 20.3a10 10 0 0 1-2.7-2.7M2.2 13.9a10 10 0 0 1 0-3.8M3.7 6.4a10 10 0 0 1 2.7-2.7',
  messagePlus: 'M7.9 20A9 9 0 1 0 4 16.1L2 22ZM8 12h8M12 8v8',
  checks: 'M18 6 7 17l-5-5M22 10l-7.5 7.5L13 16',
  pencil: 'M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z',
  cast: 'M2 8V6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-6M2 12a9 9 0 0 1 8 8M2 16a5 5 0 0 1 4 4M2 20h.01',
  download: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3',
  play: 'M6 3l14 9-14 9Z',
  user: `M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2${circ(12, 7, 4)}`,
  film: 'M7 3h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2ZM5 8h14M5 16h14M10 10.5v3l2.5-1.5Z',
  smile: `${circ(12, 12, 10)}M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01`,
  chevronDown: 'm6 9 6 6 6-6',
  newChat: 'M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.4 2.6a2.1 2.1 0 1 1 3 3L12 15l-4 1 1-4Z',
  mic: 'M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3ZM19 10v2a7 7 0 0 1-14 0v-2M12 19v3',
  arrowUp: 'm5 12 7-7 7 7M12 19V5',
  spark: 'M12 2v20M2 12h20M4.9 4.9l14.2 14.2M19.1 4.9 4.9 19.1',
  gem: 'M6 3h12l4 6-10 13L2 9ZM11 3 8 9l4 13 4-13-3-6M2 9h20',
  volumeOff: 'M11 5 6 9H2v6h4l5 4V5ZM22 9l-6 6M16 9l6 6',
  info: `${circ(12, 12, 10)}M12 16v-4M12 8h.01`,
  check: 'M20 6 9 17l-5-5',
  // Spotify
  library: 'm16 6 4 14M12 6v14M8 8v12M4 4v16',
  plusCircle: `${circ(12, 12, 10)}M8 12h8M12 8v8`,
  devices: 'M4 5h9v10H4ZM16 4h4v16h-4ZM18 16.5h.01M6.5 19h4',
  pause: 'M6 4h4v16H6ZM14 4h4v16h-4Z',
  chevronLeft: 'm15 18-6-6 6-6',
  paperclip: 'm21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48',
  reply: 'M9 17 4 12l5-5M20 18v-2a4 4 0 0 0-4-4H4',
  slashSquare: 'M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2ZM14.5 7.5l-5 9',
  sticker: `${circ(12, 12, 9)}M12 3v9l6.4 6.4`,
  // Telegram（iOS）
  shieldCheck: 'M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1ZM9 12l2 2 4-4',
  pin: 'M12 17v5M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1Z',
  plane: 'M21.2 3.6 2.9 10.6c-1 .4-1 1.7 0 2l4.6 1.5 1.8 5.5c.2.7 1.1.9 1.6.4l2.6-2.5 4.8 3.5c.6.5 1.5.1 1.7-.6l3.1-15.3c.2-.9-.7-1.7-1.6-1.4Z',
  contacts: `${circ(12, 12, 10.5)}${circ(12, 9.3, 3.7)}M5.4 18.6a8.6 8.6 0 0 1 13.2 0 9.3 9.3 0 0 1-13.2 0Z`,
  bubbles: 'M9.5 3.5c4.4 0 8 2.9 8 6.5s-3.6 6.5-8 6.5c-.9 0-1.7-.1-2.5-.3L3.4 18l.9-3.2C2.8 13.6 1.5 11.9 1.5 10c0-3.6 3.6-6.5 8-6.5ZM19.3 9.2c2 1.1 3.2 2.8 3.2 4.8 0 1.6-.8 3-2.1 4l.7 2.6-2.9-1.4c-.7.2-1.4.3-2.2.3-2.1 0-4-.7-5.3-1.9 4.5-.3 8.3-3.4 8.6-8.4Z',
  settings: `M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2Z${circ(12, 12, 3)}`,
}
type IconName = keyof typeof ICONS
/** 图标组件：<Ic n="heart" f /> ，f 为实心；尺寸用 CSS 变量 --i 控制 */
const Ic: FunctionalComponent<{ n: IconName, f?: boolean, sw?: number, eo?: boolean }> = p => h('svg', {
  'class': 'ah-i',
  'viewBox': '0 0 24 24',
  'fill': p.f ? 'currentColor' : 'none',
  'stroke': 'currentColor',
  'stroke-width': p.sw ?? 2,
  'stroke-linecap': 'round',
  'stroke-linejoin': 'round',
  'aria-hidden': 'true',
}, [h('path', { 'd': ICONS[p.n], 'fill-rule': p.eo ? 'evenodd' : undefined })])
Ic.props = { n: { type: String, required: true }, f: Boolean, sw: Number, eo: Boolean }

const chats = computed(() => Array.from({ length: 16 }, (_, i) => ({ ...at(CHATS, seed.value + i), avatar: at(IMAGES, seed.value + i), unread: i < 2 ? i + 1 : 0 })))
</script>

<template>
  <div class="android-home relative h-full w-full flex flex-col overflow-hidden select-none text-white">
    <!-- Android 蓝色壁纸（由原粉紫壁纸调色得到，原图 android-pink-wallpaper.jpg 保留） -->
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
        <span class="font-500 tracking-tight">{{ clockTime }}</span>
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
      {{ clockDate }}
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
        <!-- APP 内的系统状态栏 -->
        <div
          v-if="phase === 'app'"
          class="ah-status"
          :style="STATUS_BG[openApp.id] ? { background: STATUS_BG[openApp.id], color: '#fff' } : undefined"
        >
          <span>{{ clockTime }}</span>
          <span class="flex-1" />
          <span class="ah-status-4g">4G</span>
          <svg viewBox="0 0 14 14" aria-hidden="true"><path d="M1.5 12L12.5 1.5V12H1.5Z" fill="currentColor" /></svg>
          <svg viewBox="0 0 12 14" aria-hidden="true"><rect x="4" y="1" width="4" height="1.5" rx="0.5" fill="currentColor" /><rect x="2.5" y="2.5" width="7" height="10.5" rx="1.2" fill="currentColor" /></svg>
        </div>

        <!-- 启动页 -->
        <div
          class="android-home__splash absolute inset-0 flex flex-col items-center justify-center"
          :class="{ 'is-hidden': phase !== 'splash' }"
        >
          <img :src="openApp.icon" :alt="openApp.name" draggable="false" class="android-home__splash-icon block object-cover">
        </div>

        <!-- APP 内界面 -->
        <div class="android-home__inapp absolute inset-0 flex flex-col" :class="{ 'is-visible': phase === 'app', 'is-full': kind === 'short' || kind === 'music' || kind === 'telegram' }">
                    <div class="relative min-h-0 flex-1 overflow-hidden">
            <!-- 短视频：全屏竖视频，上滑切到下一条 -->
            <div v-if="kind === 'short'" class="android-home__shorts absolute inset-0" :class="`is-step-${shortStep}`">
              <div v-for="(src, i) in shortVideos" :key="i" class="android-home__short">
                <video v-if="phase === 'app' && Math.abs(i - shortStep) <= 1" :src="videoSrc(src)" class="absolute inset-0 h-full w-full object-cover" :autoplay="playVideo" :preload="playVideo ? 'auto' : 'metadata'" muted loop playsinline />
                <!-- 录屏素材自带 TikTok 界面，只给干净的指定视频叠加界面 -->
                <template v-if="i === 0 && video">
                  <span class="android-home__short-shade" />
                  <div class="android-home__short-tabs">
                    <span>Following</span>
                    <b>For You</b>
                  </div>
                  <div class="android-home__short-side">
                    <img :src="at(IMAGES, seed + 4)" alt="" draggable="false" class="android-home__short-avatar">
                    <span v-for="act in SHORT_ACTIONS" :key="act.key" class="android-home__short-act">
                      <svg viewBox="0 0 24 24" aria-hidden="true"><path :d="act.d" fill="currentColor" /></svg>
                      <small>{{ act.count }}</small>
                    </span>
                  </div>
                  <div class="android-home__short-cap">
                    <b>@{{ USERS[(seed + i) % USERS.length] }}</b>
                    <span>{{ CAPTIONS[(seed + i) % CAPTIONS.length] }}</span>
                  </div>
                </template>
              </div>
            </div>

            <!-- 音乐播放：参照 Spotify Android「正在播放」页 -->
            <div v-else-if="kind === 'music'" class="ah-app ah-sp" :style="{ '--tint': song.tint }">
              <!-- Spotify 首页（参照用户手机截图）：分类标签 + 快捷方式网格 + Jump back in + 迷你播放条 -->
              <div class="ah-sp-chips">
                <img :src="at(IMAGES, seed + 9)" alt="" draggable="false" class="ah-av ah-sp-me">
                <span class="is-on">All</span>
                <span>Music</span>
                <span>Podcasts</span>
                <span>Audiobooks</span>
              </div>
              <div class="ah-scroll">
                <div class="ah-sp-grid">
                  <div v-for="(tile, i) in spTiles" :key="i" class="ah-sp-tile" :class="{ 'is-tapping': i === 0 && innerTap }">
                    <span v-if="tile.liked" class="ah-sp-liked"><Ic n="heart" f :sw="0" /></span>
                    <span v-else class="ah-sp-thumb" :class="{ 'is-round': tile.round }"><img :src="tile.img" alt="" draggable="false"></span>
                    <b>{{ tile.t }}</b>
                    <span v-if="tile.playing" class="ah-sp-eq" :class="{ 'is-on': phase === 'app' }"><i /><i /><i /></span>
                  </div>
                </div>
                <div class="ah-sp-h">Jump back in</div>
                <div class="ah-sp-cards">
                  <div v-for="(c, i) in spJump" :key="i" class="ah-sp-card">
                    <img :src="c.img" alt="" draggable="false">
                    <b>{{ c.t }}</b>
                    <small>{{ c.sub }}</small>
                  </div>
                </div>
                <div class="ah-sp-h">Made For You</div>
                <div class="ah-sp-cards">
                  <div v-for="(m, i) in spMixes" :key="i" class="ah-sp-card">
                    <span class="ah-sp-mix" :style="{ '--mix': m.color }"><img :src="m.img" alt="" draggable="false"><i>{{ m.t }}</i></span>
                    <small>{{ m.sub }}</small>
                  </div>
                </div>
              </div>
              <div class="ah-sp-mini">
                <img :src="song.cover" alt="" draggable="false">
                <div class="min-w-0 flex-1">
                  <b class="block truncate">{{ song.title }}</b>
                  <span class="block truncate">{{ song.artist }}</span>
                </div>
                <Ic n="devices" />
                <Ic n="plusCircle" />
                <Ic n="pause" f :sw="0" />
                <span class="ah-sp-mini-bar"><i /></span>
              </div>
              <nav class="ah-sp-nav">
                <span class="is-on"><Ic n="home" f />Home</span>
                <span><Ic n="search" />Search</span>
                <span><Ic n="library" />Your Library</span>
                <span><Ic n="plus" />Create</span>
              </nav>

            <!-- 点击后从底部滑上来的「正在播放」页 -->
            <div
              class="android-home__music ah-sp-np"
              :class="{ 'is-playing': phase === 'app' && scrollStep >= 1, 'is-open': scrollStep >= 1 }"
            >
              <div class="android-home__np">
                <!-- 顶栏：收起箭头 / 播放来源 / 更多 -->
                <div class="android-home__np-head flex items-center justify-between">
                  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /></svg>
                  <div class="min-w-0 text-center">
                    <span class="android-home__np-from block">PLAYING FROM PLAYLIST</span>
                    <b class="block truncate">{{ song.playlist }}</b>
                  </div>
                  <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.8" fill="currentColor" /><circle cx="12" cy="12" r="1.8" fill="currentColor" /><circle cx="19" cy="12" r="1.8" fill="currentColor" /></svg>
                </div>

                <div class="android-home__cover-wrap">
                  <Transition name="ah-cover">
                    <img :key="song.title" :src="song.cover" alt="" draggable="false" class="android-home__cover">
                  </Transition>
                </div>

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
                <div class="android-home__bar"><i :key="song.title" :style="{ '--w': songPct }"><b /></i></div>
                <div class="android-home__times flex justify-between"><span>{{ songTimes[0] }}</span><span>{{ songTimes[1] }}</span></div>

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
                  <img :src="nextSong.cover" alt="" draggable="false">
                  <div class="android-home__artist-body">
                    <b class="android-home__card-title">About the artist</b>
                    <b class="block">{{ song.artist }}</b>
                    <span class="block">2.4M monthly listeners</span>
                  </div>
                </div>
              </div>
            </div>
            </div>

            <!-- Instagram：故事栏 + 方图帖子 + 底部导航 -->
            <div v-else-if="kind === 'instagram'" class="ah-app ah-ig">
              <header class="ah-bar">
                <span class="ah-ig-logo">Instagram</span>
                <span class="flex-1" />
                <Ic n="heart" />
                <Ic n="messenger" />
              </header>
              <div class="ah-scroll">
                <div class="ah-pane" :class="`is-step-${scrollStep}`" style="--s1: -66cqw; --s2: -150cqw">
                  <div class="ah-stories">
                    <div v-for="(st, i) in stories" :key="i" class="ah-story">
                      <span class="ah-story-ring" :class="{ 'is-me': i === 0 }"><img :src="st.avatar" alt="" draggable="false"></span>
                      <small>{{ i === 0 ? 'Your story' : st.user }}</small>
                    </div>
                  </div>
                  <article v-for="(post, i) in feedPosts" :key="i">
                    <div class="ah-ig-head">
                      <img :src="post.avatar" alt="" draggable="false" class="ah-av">
                      <b>{{ post.user }}</b>
                      <span class="flex-1" />
                      <Ic n="more" />
                    </div>
                    <img :src="post.image" alt="" draggable="false" class="ah-ig-img">
                    <div class="ah-ig-actions">
                      <Ic n="heart" :f="i === 0" :class="{ 'is-liked': i === 0 }" />
                      <Ic n="comment" />
                      <Ic n="send" />
                      <span class="flex-1" />
                      <Ic n="bookmark" />
                    </div>
                    <div class="ah-ig-text"><b>{{ post.likes }} likes</b></div>
                    <div class="ah-ig-text"><b>{{ post.user }}</b> {{ post.caption }}</div>
                    <div class="ah-ig-muted">View all {{ 12 + i * 7 }} comments</div>
                  </article>
                </div>
              </div>
              <nav class="ah-tabbar">
                <Ic n="home" f />
                <Ic n="search" />
                <Ic n="plusSquare" />
                <Ic n="reels" />
                <img :src="at(IMAGES, seed + 9)" alt="" draggable="false" class="ah-av ah-av-sm">
              </nav>
            </div>

            <!-- Facebook：顶部图标栏 + 分区 Tab + 发帖框 + 快拍 + 帖子 -->
            <div v-else-if="kind === 'facebook'" class="ah-app ah-fb">
              <header class="ah-bar">
                <span class="ah-fb-logo">facebook</span>
                <span class="flex-1" />
                <span class="ah-round"><Ic n="plus" /></span>
                <span class="ah-round"><Ic n="search" /></span>
                <span class="ah-round"><Ic n="messenger" /></span>
              </header>
              <nav class="ah-fb-tabs">
                <span class="is-on"><Ic n="home" f /></span>
                <span><Ic n="tv" /></span>
                <span><Ic n="users" /></span>
                <span><Ic n="store" /></span>
                <span><Ic n="bell" /></span>
                <span><Ic n="menu" /></span>
              </nav>
              <div class="ah-scroll">
                <div class="ah-pane" :class="`is-step-${scrollStep}`" style="--s1: -72cqw; --s2: -150cqw">
                  <div class="ah-fb-composer">
                    <img :src="at(IMAGES, seed + 9)" alt="" draggable="false" class="ah-av">
                    <span class="ah-fb-input">What's on your mind?</span>
                    <Ic n="image" class="is-green" />
                  </div>
                  <div class="ah-sep" />
                  <div class="ah-fb-stories">
                    <div v-for="(st, i) in stories.slice(0, 4)" :key="i" class="ah-fb-story">
                      <img :src="st.image" alt="" draggable="false">
                      <img v-if="i > 0" :src="st.avatar" alt="" draggable="false" class="ah-fb-story-av">
                      <span v-else class="ah-fb-story-plus"><Ic n="plus" :sw="3" /></span>
                      <small>{{ i === 0 ? 'Create story' : st.user }}</small>
                    </div>
                  </div>
                  <template v-for="(post, i) in fbPosts" :key="i">
                    <div class="ah-sep" />
                    <article>
                      <div class="ah-fb-head">
                        <img :src="post.avatar" alt="" draggable="false" class="ah-av">
                        <div class="min-w-0 flex-1">
                          <b>{{ post.name }}</b>
                          <small>{{ post.time }} · <Ic n="globe" /></small>
                        </div>
                        <Ic n="moreH" />
                        <Ic n="x" />
                      </div>
                      <p class="ah-fb-text">{{ post.caption }}</p>
                      <img :src="post.image" alt="" draggable="false" class="ah-fb-img">
                      <div class="ah-fb-stats">
                        <span class="ah-react bg-[#0866FF]"><Ic n="thumb" f /></span>
                        <span class="ah-react bg-[#F33E58]"><Ic n="heart" f /></span>
                        <span>{{ post.likes }}</span>
                        <span class="flex-1" />
                        <span>{{ post.comments }} comments</span>
                      </div>
                      <div class="ah-fb-btns">
                        <span><Ic n="thumb" />Like</span>
                        <span><Ic n="comment" />Comment</span>
                        <span><Ic n="share" />Share</span>
                      </div>
                    </article>
                  </template>
                </div>
              </div>
            </div>

            <!-- WhatsApp：新版安卓界面（白底绿字、搜索框、筛选标签、底部导航） -->
            <div v-else-if="kind === 'whatsapp'" class="ah-app ah-wa">
              <header class="ah-bar">
                <span class="ah-wa-title">WhatsApp</span>
                <span class="flex-1" />
                <Ic n="camera" />
                <Ic n="more" />
              </header>
              <div class="ah-wa-search"><Ic n="search" /><span>Search</span></div>
              <div class="ah-chips">
                <span class="is-on">All</span>
                <span>Unread</span>
                <span>Favourites</span>
                <span>Groups</span>
              </div>
              <div class="ah-scroll">
                <div v-for="(c, i) in chats" :key="i" class="ah-row">
                  <img :src="c.avatar" alt="" draggable="false" class="ah-av">
                  <div class="ah-row-main">
                    <div class="ah-row-top">
                      <b>{{ c.name }}</b>
                      <small :class="{ 'is-unread': c.unread }">{{ c.time }}</small>
                    </div>
                    <div class="ah-row-sub">
                      <span v-if="i === 0 && chatCount > 0 && chatCount < 4" class="is-typing">typing…</span>
                      <span v-else><Ic v-if="!c.unread && i % 3 === 1" n="checks" class="ah-tick" /><span class="truncate">{{ c.msg }}</span></span>
                      <i v-if="c.unread || (i === 0 && chatCount >= 4)" class="ah-count">{{ i === 0 && chatCount >= 4 ? c.unread + 1 : c.unread }}</i>
                    </div>
                  </div>
                </div>
              </div>
              <span class="ah-fab"><Ic n="messagePlus" /></span>
              <nav class="ah-wa-nav">
                <span class="is-on"><i><Ic n="comment" f /></i>Chats</span>
                <span><i><Ic n="updates" /></i>Updates</span>
                <span><i><Ic n="users" /></i>Communities</span>
                <span><i><Ic n="phone" /></i>Calls</span>
              </nav>
            </div>

            <!-- Telegram（参照用户 iPhone 截图）：会话列表 → 点开群聊 → 滚动查看消息、收到新消息 -->
            <div v-else-if="kind === 'telegram'" class="ah-app ah-tg">
              <div class="ah-tg-list" :class="{ 'is-away': scrollStep >= 1 }">
                <header class="ah-tg-top">
                  <span class="ah-glass ah-tg-edit">Edit</span>
                  <span class="ah-tg-title"><span class="ah-tg-logo"><Ic n="plane" f :sw="0" /></span>Chats</span>
                  <span class="ah-glass ah-tg-pair"><Ic n="shieldCheck" /><Ic n="plusCircle" /></span>
                  <span class="ah-tg-compose"><Ic n="newChat" /></span>
                </header>
                <div class="ah-tg-search"><Ic n="search" />Search</div>
                <div class="ah-scroll">
                  <div
                    v-for="(c, i) in tgChats"
                    :key="i"
                    class="ah-tg-row"
                    :class="{ 'is-pinned': c.pinned, 'is-last-pin': c.pinned && !tgChats[i + 1]?.pinned, 'is-tapping': i === TG_OPEN_ROW && innerTap }"
                  >
                    <img v-if="c.photo" :src="c.avatar" alt="" draggable="false" class="ah-tg-av">
                    <span v-else class="ah-tg-av is-initials" :style="{ background: `linear-gradient(180deg, ${c.grad[0]}, ${c.grad[1]})` }">{{ c.initials }}</span>
                    <div class="ah-tg-main">
                      <div class="ah-tg-l1">
                        <b>{{ c.name }}</b>
                        <Ic v-if="c.muted" n="volumeOff" class="ah-tg-mute" />
                        <span class="flex-1" />
                        <small><Ic v-if="c.tick" n="checks" class="ah-tg-tick" />{{ c.time }}</small>
                      </div>
                      <div class="ah-tg-l2">
                        <div class="ah-tg-preview">
                          <span v-if="c.typing" class="is-typing">typing…</span>
                          <template v-else>
                            <b v-if="c.sender">{{ c.sender }}</b>
                            <span :class="{ 'is-one': c.sender }">{{ c.msg }}</span>
                          </template>
                        </div>
                        <i v-if="c.unread" class="ah-tg-badge" :class="{ 'is-muted': c.muted }">{{ c.unread }}</i>
                        <Ic v-else-if="c.pinned" n="pin" f class="ah-tg-pin" />
                      </div>
                    </div>
                  </div>
                </div>
                <nav class="ah-tg-tabs">
                  <span><Ic n="contacts" f eo :sw="0" />Contacts</span>
                  <span><Ic n="phone" f :sw="0" />Calls</span>
                  <span class="is-on"><Ic n="bubbles" f :sw="0" />Chats<i v-if="tgBadge">{{ tgBadge }}</i></span>
                  <span><Ic n="settings" />Settings</span>
                </nav>
              </div>

              <!-- 群聊对话页：从右侧推入 -->
              <div class="ah-tg-chat" :class="{ 'is-open': scrollStep >= 1 }">
                <header class="ah-tg-chathead">
                  <span class="ah-glass ah-tg-back"><Ic n="chevronLeft" /></span>
                  <span class="ah-glass ah-tg-who">
                    <b>{{ tgChats[TG_OPEN_ROW].name }}<Ic n="volumeOff" /></b>
                    <small :class="{ 'is-typing': chatCount === 9 }">{{ tgSubtitle }}</small>
                  </span>
                  <img :src="tgChats[TG_OPEN_ROW].avatar" alt="" draggable="false" class="ah-tg-gav">
                </header>
                <div class="ah-glass ah-tg-pinbar">
                  <i />
                  <div class="min-w-0 flex-1">
                    <b>Pinned Message</b>
                    <span>Android 17 Beta / release notes · what's new in the launcher…</span>
                  </div>
                  <Ic n="x" />
                </div>
                <div ref="tgViewport" class="ah-tg-msgs">
                  <div ref="tgThreadEl" class="ah-tg-thread" :style="{ transform: `translateY(${-tgOffset}px)` }">
                    <div class="ah-tg-unread">Unread Messages</div>
                    <div v-for="(m, i) in tgThread" :key="i" class="ah-tg-msg" :class="{ 'is-first': m.first, 'is-last': m.last }">
                      <span class="ah-tg-slot">
                        <template v-if="m.last">
                          <img v-if="m.avatar" :src="m.avatar" alt="" draggable="false">
                          <span v-else :style="{ background: `linear-gradient(180deg, ${m.gradient?.[0]}, ${m.gradient?.[1]})` }">{{ m.initials }}</span>
                        </template>
                      </span>
                      <div class="ah-tg-bubble" :class="{ 'has-img': m.img }">
                        <img v-if="m.img" :src="m.img" alt="" draggable="false" class="ah-tg-photo">
                        <div v-if="m.first && !m.img" class="ah-tg-from" :style="{ color: m.color }">
                          {{ m.from }}<em v-if="m.tag">{{ m.tag }}</em>
                        </div>
                        <div v-if="m.reply" class="ah-tg-reply" :style="{ '--rc': m.replyColor }">
                          <b>{{ m.reply.from }}</b>
                          <span>{{ m.reply.text }}</span>
                        </div>
                        <div class="ah-tg-text">
                          {{ m.text }}<span class="ah-tg-time"><template v-if="m.replies"><Ic n="reply" />{{ m.replies }}&nbsp;&nbsp;</template>{{ m.time }}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <span v-if="scrollStep < 2" class="ah-glass ah-tg-down"><i>201</i><Ic n="chevronDown" /></span>
                <div class="ah-tg-input">
                  <span class="ah-glass ah-tg-circle"><Ic n="paperclip" /></span>
                  <span class="ah-glass ah-tg-field">Message<span class="flex-1" /><Ic n="slashSquare" /><Ic n="sticker" /></span>
                  <span class="ah-glass ah-tg-circle"><Ic n="mic" /></span>
                </div>
              </div>
            </div>

            <!-- Claude：顶栏 + 对话（最后一条逐字输出）+ 输入框 -->
            <div v-else-if="kind === 'claude'" class="ah-app ah-cl">
              <header class="ah-bar">
                <Ic n="menu" />
                <span class="ah-cl-title">Claude<Ic n="chevronDown" /></span>
                <Ic n="newChat" />
              </header>
              <div class="ah-cl-msgs">
                <div class="ah-cl-me">{{ CLAUDE_MSGS[0].text }}</div>
                <div class="ah-cl-ai">{{ CLAUDE_MSGS[1].text }}</div>
                <div class="ah-cl-me">{{ CLAUDE_MSGS[2].text }}</div>
                <div class="ah-cl-ai">
                  {{ claudeTyped }}<span v-if="claudeTyped.length < CLAUDE_MSGS[3].text.length" class="ah-cl-caret" />
                  <Ic n="spark" class="ah-cl-spark" />
                </div>
              </div>
              <div class="ah-cl-input">
                <span>Reply to Claude…</span>
                <div class="ah-cl-tools">
                  <Ic n="plus" />
                  <span class="flex-1" />
                  <Ic n="mic" />
                  <span class="ah-cl-send"><Ic n="arrowUp" /></span>
                </div>
              </div>
            </div>

            <!-- Twitch：竖屏观看直播 = 播放器 + 主播信息 + 实时聊天 -->
            <div v-else-if="kind === 'live'" class="ah-app ah-tw">
              <div class="ah-tw-player">
                <video v-if="phase === 'app'" :src="videoSrc(playerVideo)" :autoplay="playVideo" :preload="playVideo ? 'auto' : 'metadata'" muted loop playsinline />
                <span class="ah-tw-live">LIVE</span>
                <span class="ah-tw-viewers"><Ic n="user" />{{ twitchViewers }}</span>
              </div>
              <div class="ah-tw-info">
                <span class="ah-tw-av"><img :src="at(IMAGES, seed + 4)" alt="" draggable="false"><span>LIVE</span></span>
                <div class="ah-tw-meta">
                  <b>chill_travel</b>
                  <span class="block truncate">Windy cliffs & sea stacks 🌊 | !camera</span>
                  <span class="is-cat">Travel & Outdoors</span>
                  <div class="ah-tw-tags"><i>English</i><i>IRL</i><i>Chill</i></div>
                </div>
                <span class="ah-tw-follow"><Ic n="heart" />Follow</span>
              </div>
              <div class="ah-tw-chat-title">STREAM CHAT</div>
              <TransitionGroup tag="div" name="ah-chat" class="ah-tw-chat">
                <div v-for="(m, i) in twitchChat" :key="i" class="ah-tw-msg">
                  <i v-if="m.b" :style="{ background: m.b }" /><b :style="{ color: m.c }">{{ m.u }}</b>: {{ m.m }}
                </div>
              </TransitionGroup>
              <div class="ah-tw-input">
                <Ic n="gem" class="is-purple" />
                <span>Send a message</span>
                <Ic n="smile" />
              </div>
            </div>

            <!-- 流媒体首页：Netflix / Disney+ / Prime Video / Hulu -->
            <div v-else-if="kind === 'stream'" class="ah-app ah-st" :class="`is-${openApp.id}`" :style="{ '--st-bg': stream.bg }">
              <header class="ah-bar">
                <template v-if="openApp.id === 'netflix'">
                  <span class="ah-nf-logo">N</span>
                  <b class="ah-st-greet">For You</b>
                  <span class="flex-1" />
                  <Ic n="cast" />
                  <Ic n="download" />
                  <Ic n="search" />
                </template>
                <template v-else-if="openApp.id === 'disney'">
                  <span class="flex-1" />
                  <span class="ah-dp-logo">Disney<i>+</i></span>
                  <span class="flex-1" />
                </template>
                <template v-else>
                  <span v-if="openApp.id === 'primevideo'" class="ah-pv-logo">prime <i>video</i></span>
                  <span v-else class="ah-hulu-logo">hulu</span>
                  <span class="flex-1" />
                  <Ic n="cast" />
                  <img :src="at(IMAGES, seed + 9)" alt="" draggable="false" class="ah-av ah-av-sm">
                </template>
              </header>
              <div class="ah-scroll">
                <div class="ah-pane" :class="`is-step-${scrollStep}`" :style="{ '--s1': stream.s1, '--s2': stream.s2 }">
                  <div v-if="stream.chips.length" class="ah-chips is-dark">
                    <span v-for="(c, i) in stream.chips" :key="c" :class="{ 'is-on': i === 0 && openApp.id !== 'netflix' }">{{ c }}<Ic v-if="openApp.id === 'netflix' && i === 2" n="chevronDown" /></span>
                  </div>
                  <div class="ah-hero" :class="`is-${stream.hero}`">
                    <video v-if="phase === 'app'" :src="videoSrc(playerVideo)" :autoplay="playVideo" :preload="playVideo ? 'auto' : 'metadata'" muted loop playsinline />
                    <span class="ah-hero-shade" />
                    <div class="ah-hero-info">
                      <span class="ah-hero-title">{{ stream.title }}</span>
                      <span class="ah-hero-tags">
                        <Ic v-if="openApp.id === 'primevideo'" n="check" class="is-blue" />{{ stream.tags }}
                      </span>
                      <div v-if="stream.hero === 'tall'" class="ah-hero-btns">
                        <span class="ah-btn is-white"><Ic n="play" f />Play</span>
                        <span class="ah-btn is-gray"><Ic n="plus" />My List</span>
                      </div>
                    </div>
                  </div>
                  <div v-if="stream.hero === 'wide'" class="ah-dots"><i class="is-on" /><i /><i /><i /><i /></div>
                  <div v-if="openApp.id === 'disney'" class="ah-brands">
                    <span v-for="b in BRANDS" :key="b">{{ b }}</span>
                  </div>
                  <section v-for="(row, ri) in stream.rows" :key="ri" class="ah-st-row">
                    <b>{{ row.t }}</b>
                    <div class="ah-posters">
                      <template v-if="row.type === 'top10'">
                        <div v-for="k in 3" :key="k" class="ah-top10"><span>{{ k }}</span><img :src="at(posters, ri + k)" alt="" draggable="false"></div>
                      </template>
                      <template v-else>
                        <div v-for="k in 4" :key="k" class="ah-poster" :class="{ 'is-wide': row.type === 'wide' }">
                          <img :src="at(posters, ri * 2 + k)" alt="" draggable="false">
                          <span v-if="row.type !== 'poster'" class="ah-prog"><i :style="{ width: `${25 + ((k * 23 + ri * 11) % 60)}%` }" /></span>
                        </div>
                      </template>
                    </div>
                  </section>
                </div>
              </div>
              <nav class="ah-st-nav">
                <span v-for="(item, ni) in stream.nav" :key="ni" :class="{ 'is-on': ni === 0 }"><Ic :n="item.i" :f="ni === 0 && item.i === 'home'" /><template v-if="item.l">{{ item.l }}</template></span>
              </nav>
            </div>
          </div>
        </div>

        <!-- APP 内的手势导航横条，底色跟随 APP 背景 -->
        <div class="android-home__navbar android-home__navbar--app absolute bottom-0 left-0 right-0 z-4 flex items-center justify-center" :style="{ background: navBg, color: theme.light ? '#1f1f1f' : '#fff' }">
          <span class="android-home__gesture" />
        </div>
      </div>
    </Transition>

    <!-- 底部 Android 手势导航横条 -->
    <div class="android-home__navbar relative z-1 flex shrink-0 items-center justify-center">
      <span class="android-home__gesture" />
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

/* 短视频全屏：视频铺到状态栏下面 */
.android-home__inapp.is-full {
  padding-top: 0;
}

.android-home__feed.is-chat.is-step-1 { transform: translateY(-24cqw); }
.android-home__feed.is-chat.is-step-2 { transform: translateY(-50cqw); }
.android-home__feed.is-player.is-step-1 { transform: translateY(-30cqw); }
.android-home__feed.is-player.is-step-2 { transform: translateY(-62cqw); }

/* 录屏素材右侧带 TikTok 按钮：视频放宽到 130% 并左对齐，把右侧按钮裁到画面外 */
.android-home__player-video {
  left: -3%;
  width: 130%;
  max-width: none;
}

.android-home__short-shade {
  position: absolute;
  inset: auto 0 0;
  height: 40%;
  background: linear-gradient(180deg, transparent, rgba(0, 0, 0, 0.28));
  pointer-events: none;
}

.android-home__short-tabs {
  position: absolute;
  top: 10cqw;
  left: 0;
  right: 0;
  display: flex;
  justify-content: center;
  gap: 5cqw;
  font-size: 4cqw;
}

.android-home__short-tabs span {
  opacity: 0.7;
}

.android-home__short-tabs b {
  padding-bottom: 1cqw;
  border-bottom: 0.7cqw solid #fff;
}

.android-home__short-avatar {
  width: 10cqw;
  height: 10cqw;
  margin-bottom: 1cqw;
  border: 0.5cqw solid #fff;
  border-radius: 50%;
  object-fit: cover;
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
  bottom: 22cqw;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4.5cqw;
}

.android-home__short-act {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.6cqw;
}

.android-home__short-act svg {
  width: 8.5cqw;
  height: 8.5cqw;
}

.android-home__short-act small {
  font-size: 2.8cqw;
  font-weight: 600;
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
  background: linear-gradient(180deg, var(--tint) 0%, color-mix(in srgb, var(--tint) 62%, #121212) 48%, color-mix(in srgb, var(--tint) 22%, #0b0b0b) 100%);
  transition: background 0.6s ease;
}

/* 播放页：铺到状态栏下面，左右留 6% 边距（与真实 Spotify 一致） */
.android-home__np {
  padding: 10cqw 6cqw 0;
}

.android-home__cover-wrap {
  position: relative;
  width: 100%;
  aspect-ratio: 1;
  margin-top: 9cqw;
}

.android-home__cover-wrap .android-home__cover {
  position: absolute;
  inset: 0;
  margin: 0;
}

.ah-cover-enter-active,
.ah-cover-leave-active {
  transition: opacity 0.45s ease, transform 0.45s ease;
}

.ah-cover-enter-from {
  opacity: 0;
  transform: translateX(8%);
}

.ah-cover-leave-to {
  opacity: 0;
  transform: translateX(-8%);
}

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
  border-radius: 2cqw;
  object-fit: cover;
  box-shadow: 0 4cqw 12cqw rgba(0, 0, 0, 0.45);
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
  width: var(--w, 0%);
  max-width: 100%;
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

/* 进度条慢慢往前走 */
.android-home__music.is-playing .android-home__bar i {
  animation: ah-progress 40s linear forwards;
}

@keyframes ah-progress {
  to { width: calc(var(--w, 0%) + 16%); }
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
  margin-top: 7cqw;
  padding: 4.4cqw;
  border-radius: 2.4cqw;
  background: color-mix(in srgb, var(--tint) 82%, #fff 18%);
  transition: background 0.6s ease;
}

.android-home__lyrics p {
  margin: 0 0 1.6cqw;
  font-size: 5cqw;
  font-weight: 800;
  line-height: 1.3;
  color: rgba(0, 0, 0, 0.72);
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
  height: 6cqw;
}

/* 手势导航横条：居中的圆角小横条 */
.android-home__gesture {
  width: 32cqw;
  height: 1.3cqw;
  border-radius: 999px;
  background: currentColor;
  opacity: 0.85;
}

/* APP 内容区让出手势条的高度 */
.android-home__inapp,
.android-home__splash {
  bottom: 6cqw;
}


/* ================= 各 APP 真实界面 ================= */

.ah-i {
  width: var(--i, 6cqw);
  height: var(--i, 6cqw);
  flex-shrink: 0;
}

.ah-status {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 4;
  display: flex;
  height: 9cqw;
  align-items: center;
  gap: 1.6cqw;
  padding: 0 4.8cqw;
  font-size: 3.6cqw;
  font-weight: 500;
  pointer-events: none;
}

.ah-status svg {
  width: 3.4cqw;
  height: 3.4cqw;
}

.ah-status-4g {
  font-size: 3cqw;
}

.ah-app {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.ah-bar {
  display: flex;
  height: 12cqw;
  flex-shrink: 0;
  align-items: center;
  gap: 4.2cqw;
  padding: 0 4cqw;
  --i: 6cqw;
}

.ah-scroll {
  position: relative;
  min-height: 0;
  flex: 1;
  overflow: hidden;
}

.ah-pane {
  transition: transform 1.5s cubic-bezier(0.25, 0.75, 0.3, 1);
}

.ah-pane.is-step-1 {
  transform: translateY(var(--s1, -60cqw));
}

.ah-pane.is-step-2 {
  transition-duration: 1.3s;
  transform: translateY(var(--s2, -130cqw));
}

.ah-av {
  display: block;
  width: 8cqw;
  height: 8cqw;
  flex-shrink: 0;
  border-radius: 50%;
  object-fit: cover;
}

.ah-av-sm {
  width: 6.4cqw;
  height: 6.4cqw;
}

.ah-tabbar {
  display: flex;
  height: 12cqw;
  flex-shrink: 0;
  align-items: center;
  justify-content: space-around;
  border-top: 1px solid rgba(0, 0, 0, 0.08);
  --i: 6.4cqw;
}

.ah-chips {
  display: flex;
  gap: 1.8cqw;
  padding: 0 4cqw 2.4cqw;
  font-size: 3cqw;
  white-space: nowrap;
}

.ah-chips > span {
  display: flex;
  align-items: center;
  gap: 0.6cqw;
  padding: 1.2cqw 3cqw;
  border-radius: 999px;
  background: #f0f2f5;
  color: #54656f;
  --i: 3.2cqw;
}

/* ---------- Instagram ---------- */
.ah-ig {
  background: #fff;
  color: #000;
}

.ah-ig-logo {
  font-family: 'Snell Roundhand', 'Brush Script MT', 'Segoe Script', cursive;
  font-size: 7.6cqw;
  font-weight: 700;
  line-height: 1;
}

.ah-stories {
  display: flex;
  gap: 3cqw;
  padding: 1cqw 3cqw 3cqw;
  overflow: hidden;
  border-bottom: 1px solid #efefef;
}

.ah-story {
  display: flex;
  width: 16.5cqw;
  flex-shrink: 0;
  flex-direction: column;
  align-items: center;
  gap: 1cqw;
  font-size: 2.6cqw;
}

.ah-story small {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ah-story-ring {
  padding: 0.6cqw;
  border-radius: 50%;
  background: linear-gradient(45deg, #feda75, #fa7e1e, #d62976, #962fbf, #4f5bd5);
}

.ah-story-ring.is-me {
  background: #dbdbdb;
}

.ah-story-ring img {
  display: block;
  width: 15cqw;
  height: 15cqw;
  border: 0.6cqw solid #fff;
  border-radius: 50%;
  object-fit: cover;
}

.ah-ig-head {
  display: flex;
  align-items: center;
  gap: 2.4cqw;
  padding: 2.4cqw 3cqw;
  font-size: 3.2cqw;
  --i: 4.4cqw;
}

.ah-ig-img {
  display: block;
  width: 100%;
  aspect-ratio: 1;
  object-fit: cover;
}

.ah-ig-actions {
  display: flex;
  align-items: center;
  gap: 3.6cqw;
  padding: 2.4cqw 3cqw 1cqw;
  --i: 6.4cqw;
}

.ah-ig-actions .is-liked {
  color: #ff3040;
}

.ah-ig-text {
  padding: 0.4cqw 3cqw;
  font-size: 3.1cqw;
  line-height: 1.35;
}

.ah-ig-muted {
  padding: 0.4cqw 3cqw 4cqw;
  font-size: 3cqw;
  color: #737373;
}

/* ---------- Facebook ---------- */
.ah-fb {
  background: #fff;
  color: #050505;
}

.ah-fb .ah-bar {
  gap: 2cqw;
}

.ah-fb-logo {
  color: #0866ff;
  font-family: Helvetica, Arial, sans-serif;
  font-size: 7.6cqw;
  font-weight: 800;
  letter-spacing: -0.04em;
}

.ah-round {
  display: flex;
  width: 8.6cqw;
  height: 8.6cqw;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: #e4e6eb;
  --i: 4.8cqw;
}

.ah-fb-tabs {
  display: flex;
  flex-shrink: 0;
  justify-content: space-around;
  border-bottom: 1px solid #ddd;
  color: #65676b;
  --i: 6cqw;
}

.ah-fb-tabs > span {
  padding: 2cqw 2.4cqw 2.4cqw;
}

.ah-fb-tabs .is-on {
  color: #0866ff;
  box-shadow: inset 0 -0.7cqw 0 #0866ff;
}

.ah-fb-composer {
  display: flex;
  align-items: center;
  gap: 2.4cqw;
  padding: 3cqw;
  --i: 6cqw;
}

.ah-fb-composer .is-green {
  color: #45bd62;
}

.ah-fb-input {
  flex: 1;
  padding: 2cqw 3.4cqw;
  border: 1px solid #ccd0d5;
  border-radius: 999px;
  font-size: 3.2cqw;
  color: #65676b;
}

.ah-sep {
  height: 1.8cqw;
  background: #c9ccd1;
}

.ah-fb-stories {
  display: flex;
  gap: 2cqw;
  padding: 3cqw;
  overflow: hidden;
}

.ah-fb-story {
  position: relative;
  width: 24cqw;
  height: 40cqw;
  flex-shrink: 0;
  overflow: hidden;
  border-radius: 2.4cqw;
  background: #ddd;
}

.ah-fb-story > img:first-child {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.ah-fb-story-av {
  position: absolute;
  left: 2cqw;
  top: 2cqw;
  width: 8cqw;
  height: 8cqw;
  border: 0.7cqw solid #0866ff;
  border-radius: 50%;
  object-fit: cover;
}

.ah-fb-story-plus {
  position: absolute;
  left: 2cqw;
  top: 2cqw;
  display: flex;
  width: 8cqw;
  height: 8cqw;
  align-items: center;
  justify-content: center;
  border: 0.7cqw solid #fff;
  border-radius: 50%;
  background: #0866ff;
  color: #fff;
  --i: 4cqw;
}

.ah-fb-story small {
  position: absolute;
  left: 2cqw;
  right: 2cqw;
  bottom: 2cqw;
  color: #fff;
  font-size: 2.6cqw;
  font-weight: 600;
  line-height: 1.2;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
}

.ah-fb-head {
  display: flex;
  align-items: center;
  gap: 2.4cqw;
  padding: 3cqw 3cqw 1.6cqw;
  color: #65676b;
  --i: 4.8cqw;
}

.ah-fb-head b {
  display: block;
  overflow: hidden;
  color: #050505;
  font-size: 3.3cqw;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ah-fb-head small {
  display: flex;
  align-items: center;
  gap: 1cqw;
  font-size: 2.7cqw;
  --i: 2.6cqw;
}

.ah-fb-text {
  margin: 0;
  padding: 0 3cqw 2.4cqw;
  font-size: 3.3cqw;
  line-height: 1.35;
}

.ah-fb-img {
  display: block;
  width: 100%;
  aspect-ratio: 4 / 3;
  object-fit: cover;
}

.ah-fb-stats {
  display: flex;
  align-items: center;
  gap: 1.2cqw;
  padding: 2.4cqw 3cqw;
  font-size: 2.9cqw;
  color: #65676b;
}

.ah-react {
  display: flex;
  width: 4.4cqw;
  height: 4.4cqw;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  color: #fff;
  --i: 2.6cqw;
}

.ah-react + .ah-react {
  margin-left: -2cqw;
  box-shadow: 0 0 0 0.4cqw #fff;
}

.ah-fb-btns {
  display: flex;
  justify-content: space-around;
  margin: 0 3cqw;
  padding: 1.6cqw 0 2.4cqw;
  border-top: 1px solid #ced0d4;
  color: #65676b;
  font-size: 3cqw;
  font-weight: 600;
  --i: 4.8cqw;
}

.ah-fb-btns span {
  display: flex;
  align-items: center;
  gap: 1.4cqw;
}

/* ---------- 会话列表通用 ---------- */
.ah-row {
  display: flex;
  align-items: center;
  gap: 3.2cqw;
  padding: 2.4cqw 4cqw;
}

.ah-row .ah-av {
  width: 12cqw;
  height: 12cqw;
}

.ah-row-main {
  min-width: 0;
  flex: 1;
}

.ah-row-top,
.ah-row-sub {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 2cqw;
}

.ah-row-top b {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 1cqw;
  overflow: hidden;
  font-size: 3.7cqw;
  font-weight: 600;
  white-space: nowrap;
  --i: 3.4cqw;
}

.ah-row-top small {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 0.8cqw;
  font-size: 2.8cqw;
  color: #667781;
  --i: 3.8cqw;
}

.ah-row-sub {
  margin-top: 0.6cqw;
}

.ah-row-sub > span {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 1cqw;
  overflow: hidden;
  font-size: 3.3cqw;
  color: #667781;
  white-space: nowrap;
  --i: 4cqw;
}

.ah-row-sub > span.truncate {
  display: block;
}

.ah-row-sub .is-typing {
  color: #1daa61;
}

.ah-count {
  display: flex;
  min-width: 5cqw;
  height: 5cqw;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  padding: 0 1.4cqw;
  border-radius: 999px;
  background: #25d366;
  color: #fff;
  font-size: 2.8cqw;
  font-style: normal;
  font-weight: 700;
}

.ah-tick {
  color: #53bdeb;
}

.ah-fab {
  position: absolute;
  right: 4cqw;
  bottom: 17cqw;
  display: flex;
  width: 13cqw;
  height: 13cqw;
  align-items: center;
  justify-content: center;
  border-radius: 4cqw;
  color: #fff;
  box-shadow: 0 1cqw 3cqw rgba(0, 0, 0, 0.2);
  --i: 6cqw;
}

/* ---------- WhatsApp ---------- */
.ah-wa {
  background: #fff;
  color: #111b21;
}

.ah-wa-title {
  color: #1daa61;
  font-size: 6.2cqw;
  font-weight: 700;
}

.ah-wa-search {
  display: flex;
  align-items: center;
  gap: 2.4cqw;
  margin: 0 4cqw 2.4cqw;
  padding: 2.4cqw 3.6cqw;
  border-radius: 999px;
  background: #f0f2f5;
  color: #667781;
  font-size: 3.4cqw;
  --i: 4.6cqw;
}

.ah-wa .ah-chips .is-on {
  background: #d8fdd2;
  color: #15603e;
  font-weight: 600;
}

.ah-wa .ah-row-top small.is-unread {
  color: #1daa61;
  font-weight: 600;
}

.ah-wa .ah-fab {
  background: #1daa61;
}

.ah-wa-nav {
  display: flex;
  flex-shrink: 0;
  justify-content: space-around;
  padding: 2cqw 0 2.6cqw;
  border-top: 1px solid #e9edef;
  color: #54656f;
  font-size: 2.7cqw;
  font-weight: 600;
  --i: 5.4cqw;
}

.ah-wa-nav > span {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1cqw;
}

.ah-wa-nav i {
  display: flex;
  padding: 0.8cqw 4cqw;
  border-radius: 999px;
  font-style: normal;
}

.ah-wa-nav .is-on {
  color: #111b21;
}

.ah-wa-nav .is-on i {
  background: #d8fdd2;
}

/* ---------- Claude ---------- */
.ah-cl {
  background: #faf9f5;
  color: #1f1e1d;
}

.ah-cl-title {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  gap: 1cqw;
  font-size: 3.8cqw;
  font-weight: 600;
  --i: 3.6cqw;
}

.ah-cl-msgs {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  justify-content: flex-end;
  gap: 4cqw;
  overflow: hidden;
  padding: 2cqw 4cqw;
  font-size: 3.3cqw;
  line-height: 1.5;
}

.ah-cl-me {
  align-self: flex-end;
  max-width: 80%;
  padding: 2.4cqw 3.4cqw;
  border-radius: 3.6cqw;
  background: #f0eee6;
  line-height: 1.4;
}

.ah-cl-caret {
  display: inline-block;
  width: 1.6cqw;
  height: 3.4cqw;
  margin-left: 0.4cqw;
  border-radius: 0.4cqw;
  background: #1f1e1d;
  vertical-align: -0.4cqw;
  animation: ah-blink 0.8s steps(1) infinite;
}

@keyframes ah-blink {
  50% { opacity: 0; }
}

.ah-cl-spark {
  display: block;
  margin-top: 2cqw;
  color: #d97757;
  --i: 5cqw;
}

.ah-cl-input {
  margin: 0 3cqw 3cqw;
  padding: 3cqw;
  border: 1px solid #e5e3da;
  border-radius: 4cqw;
  background: #fff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.ah-cl-input > span {
  display: block;
  color: #8a8780;
  font-size: 3.3cqw;
}

.ah-cl-tools {
  display: flex;
  align-items: center;
  gap: 2.4cqw;
  margin-top: 3cqw;
  color: #5f5c55;
  --i: 4.6cqw;
}

.ah-cl-send {
  display: flex;
  width: 7.4cqw;
  height: 7.4cqw;
  align-items: center;
  justify-content: center;
  border-radius: 2cqw;
  background: #d97757;
  color: #fff;
  --i: 4cqw;
}

/* ---------- Twitch ---------- */
.ah-tw {
  background: #0e0e10;
  color: #efeff1;
}

.ah-tw-player {
  position: relative;
  width: 100%;
  flex-shrink: 0;
  aspect-ratio: 16 / 9;
  overflow: hidden;
  background: #000;
}

/* 素材是 TikTok 录屏：放宽并左移，把右侧的按钮裁到画面外 */
.ah-tw-player video {
  position: absolute;
  top: 0;
  left: -3%;
  width: 130%;
  max-width: none;
  height: 100%;
  object-fit: cover;
}

.ah-tw-live {
  position: absolute;
  left: 2.4cqw;
  top: 2.4cqw;
  padding: 0.4cqw 1.4cqw;
  border-radius: 0.8cqw;
  background: #eb0400;
  font-size: 2.6cqw;
  font-weight: 700;
}

.ah-tw-viewers {
  position: absolute;
  left: 2.4cqw;
  bottom: 2.4cqw;
  display: flex;
  align-items: center;
  gap: 1cqw;
  padding: 0.4cqw 1.4cqw;
  border-radius: 0.8cqw;
  background: rgba(0, 0, 0, 0.6);
  font-size: 2.6cqw;
  --i: 3cqw;
}

.ah-tw-info {
  display: flex;
  flex-shrink: 0;
  gap: 2.6cqw;
  padding: 3cqw;
  border-bottom: 1px solid #26262c;
}

.ah-tw-av {
  position: relative;
  flex-shrink: 0;
  align-self: flex-start;
}

.ah-tw-av img {
  display: block;
  width: 10cqw;
  height: 10cqw;
  border: 0.6cqw solid #eb0400;
  border-radius: 50%;
  object-fit: cover;
}

.ah-tw-av span {
  position: absolute;
  left: 50%;
  bottom: -1.4cqw;
  padding: 0 1cqw;
  border-radius: 0.6cqw;
  background: #eb0400;
  font-size: 2cqw;
  font-weight: 700;
  transform: translateX(-50%);
}

.ah-tw-meta {
  min-width: 0;
  flex: 1;
  font-size: 2.9cqw;
  line-height: 1.35;
}

.ah-tw-meta b {
  display: block;
  font-size: 3.5cqw;
}

.ah-tw-meta .is-cat {
  color: #bf94ff;
}

.ah-tw-tags {
  display: flex;
  gap: 1.2cqw;
  margin-top: 1cqw;
}

.ah-tw-tags i {
  padding: 0.3cqw 1.6cqw;
  border-radius: 999px;
  background: #2f2f35;
  color: #adadb8;
  font-size: 2.4cqw;
  font-style: normal;
}

.ah-tw-follow {
  display: flex;
  flex-shrink: 0;
  align-self: flex-start;
  align-items: center;
  gap: 1cqw;
  padding: 1.4cqw 2.4cqw;
  border-radius: 1.2cqw;
  background: #9147ff;
  font-size: 2.9cqw;
  font-weight: 700;
  --i: 3.6cqw;
}

.ah-tw-chat-title {
  flex-shrink: 0;
  padding: 2cqw 0;
  border-bottom: 1px solid #26262c;
  color: #adadb8;
  font-size: 2.6cqw;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-align: center;
}

.ah-tw-chat {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  justify-content: flex-end;
  gap: 1.4cqw;
  overflow: hidden;
  padding: 2cqw 3cqw;
  font-size: 3cqw;
  line-height: 1.4;
}

.ah-tw-msg i {
  display: inline-block;
  width: 3cqw;
  height: 3cqw;
  margin-right: 1cqw;
  border-radius: 0.6cqw;
  vertical-align: -0.4cqw;
}

.ah-chat-enter-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}

.ah-chat-enter-from {
  opacity: 0;
  transform: translateY(2cqw);
}

.ah-tw-input {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 2.4cqw;
  padding: 2.4cqw 3cqw 3cqw;
  --i: 5cqw;
}

.ah-tw-input .is-purple {
  color: #bf94ff;
}

.ah-tw-input > span {
  flex: 1;
  padding: 2cqw 3cqw;
  border-radius: 1.4cqw;
  background: #26262c;
  color: #adadb8;
  font-size: 3cqw;
}

/* ---------- 流媒体首页 ---------- */
.ah-st {
  background: var(--st-bg);
  color: #fff;
}

.ah-st-greet {
  font-size: 4.8cqw;
}

.ah-nf-logo {
  color: #e50914;
  font-family: 'Arial Black', Impact, sans-serif;
  font-size: 8cqw;
  font-weight: 900;
  line-height: 1;
  transform: scaleY(1.15);
}

.ah-dp-logo {
  font-family: 'Snell Roundhand', 'Brush Script MT', cursive;
  font-size: 7.4cqw;
  font-weight: 700;
}

.ah-dp-logo i {
  margin-left: 0.4cqw;
  color: #4fd0ff;
  font-family: Helvetica, Arial, sans-serif;
  font-style: normal;
}

.ah-pv-logo {
  font-size: 5.4cqw;
  font-weight: 800;
  letter-spacing: -0.02em;
}

.ah-pv-logo i {
  color: #1a98ff;
  font-style: normal;
}

.ah-hulu-logo {
  color: #1ce783;
  font-size: 7cqw;
  font-weight: 900;
  letter-spacing: -0.04em;
}

.ah-chips.is-dark > span {
  border: 1px solid rgba(255, 255, 255, 0.45);
  background: transparent;
  color: #fff;
}

.ah-chips.is-dark > span.is-on {
  border-color: #fff;
  background: #fff;
  color: #000;
  font-weight: 600;
}

.ah-hero {
  position: relative;
  margin: 0 4cqw;
  overflow: hidden;
  border-radius: 2.4cqw;
  background: #222;
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.12);
}

.ah-hero.is-tall {
  aspect-ratio: 4 / 5;
}

.ah-hero.is-wide {
  aspect-ratio: 16 / 10;
}

.ah-hero video {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.ah-hero-shade {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, transparent 40%, rgba(0, 0, 0, 0.85));
}

.ah-hero-info {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2cqw;
  padding: 4cqw;
  text-align: center;
}

.ah-hero.is-wide .ah-hero-info {
  align-items: flex-start;
  gap: 1cqw;
  padding: 3cqw 3.4cqw;
  text-align: left;
}

.ah-hero-title {
  font-size: 7cqw;
  font-weight: 900;
  letter-spacing: 0.02em;
  line-height: 1.05;
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.6);
}

.ah-hero.is-wide .ah-hero-title {
  font-size: 5.4cqw;
}

.ah-hero-tags {
  display: flex;
  align-items: center;
  gap: 1cqw;
  font-size: 2.8cqw;
  opacity: 0.9;
  --i: 3.4cqw;
}

.ah-hero-tags .is-blue {
  color: #1a98ff;
}

.ah-hero-btns {
  display: flex;
  width: 100%;
  gap: 2.4cqw;
}

.ah-btn {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  gap: 1.4cqw;
  padding: 2.2cqw 0;
  border-radius: 1.2cqw;
  font-size: 3.3cqw;
  font-weight: 700;
  --i: 4.4cqw;
}

.ah-btn.is-white {
  background: #fff;
  color: #000;
}

.ah-btn.is-gray {
  background: rgba(109, 109, 110, 0.7);
  color: #fff;
}

.ah-dots {
  display: flex;
  justify-content: center;
  gap: 1.2cqw;
  padding-top: 2.4cqw;
}

.ah-dots i {
  width: 1.4cqw;
  height: 1.4cqw;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.35);
}

.ah-dots i.is-on {
  background: #fff;
}

.ah-brands {
  display: flex;
  gap: 1.6cqw;
  padding: 3.4cqw 4cqw 0;
}

.ah-brands span {
  display: flex;
  flex: 1;
  aspect-ratio: 16 / 10;
  align-items: center;
  justify-content: center;
  border-radius: 1.4cqw;
  background: linear-gradient(160deg, #30343f, #1b1e27);
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.18);
  font-size: 2.2cqw;
  font-weight: 800;
  white-space: nowrap;
}

.ah-st-row {
  padding: 5cqw 0 0 4cqw;
}

.ah-st-row > b {
  display: block;
  margin-bottom: 2cqw;
  font-size: 3.7cqw;
}

.ah-posters {
  display: flex;
  gap: 2cqw;
  overflow: hidden;
}

.ah-poster {
  position: relative;
  width: 26cqw;
  flex-shrink: 0;
  overflow: hidden;
  border-radius: 1.2cqw;
}

.ah-poster.is-wide {
  width: 40cqw;
}

.ah-poster img {
  display: block;
  width: 100%;
  aspect-ratio: 2 / 3;
  object-fit: cover;
}

.ah-poster.is-wide img {
  aspect-ratio: 16 / 9;
}

.ah-prog {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 0.9cqw;
  background: rgba(255, 255, 255, 0.3);
}

.ah-prog i {
  display: block;
  height: 100%;
  background: var(--accent);
}

.ah-top10 {
  display: flex;
  width: 36cqw;
  flex-shrink: 0;
  align-items: flex-end;
}

.ah-top10 span {
  margin-right: -3cqw;
  color: var(--st-bg);
  font-size: 22cqw;
  font-weight: 900;
  line-height: 0.8;
  -webkit-text-stroke: 0.5cqw #8c8c8c;
}

.ah-top10 img {
  position: relative;
  width: 22cqw;
  aspect-ratio: 2 / 3;
  border-radius: 1.2cqw;
  object-fit: cover;
}

.ah-st-nav {
  display: flex;
  flex-shrink: 0;
  justify-content: space-around;
  padding: 2cqw 0 2.6cqw;
  background: var(--st-bg);
  color: rgba(255, 255, 255, 0.6);
  font-size: 2.6cqw;
  --i: 5.6cqw;
}

.ah-st-nav > span {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.8cqw;
}

.ah-st-nav .is-on {
  color: #fff;
}

/* ---------- Spotify 首页 ---------- */
.ah-sp {
  padding-top: 9cqw;
  background: #121212;
  color: #fff;
}

.ah-sp-chips {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 2cqw;
  padding: 1.6cqw 4cqw 2.4cqw;
  font-size: 3.2cqw;
  white-space: nowrap;
}

.ah-sp-me {
  width: 8cqw;
  height: 8cqw;
  margin-right: 0.6cqw;
}

.ah-sp-chips > span {
  padding: 1.6cqw 3.4cqw;
  border-radius: 999px;
  background: #2a2a2a;
}

.ah-sp-chips > span.is-on {
  background: #1ed760;
  color: #000;
}

.ah-sp-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.8cqw;
  padding: 0 4cqw;
}

.ah-sp-tile {
  position: relative;
  display: flex;
  height: 12cqw;
  align-items: center;
  gap: 2.4cqw;
  overflow: hidden;
  padding-right: 2cqw;
  border-radius: 1cqw;
  background: #2a2a2a;
  transition: transform 0.15s ease, background-color 0.15s ease;
}

.ah-sp-tile.is-tapping {
  background: #3e3e3e;
  transform: scale(0.96);
}

.ah-sp-tile b {
  display: -webkit-box;
  min-width: 0;
  flex: 1;
  overflow: hidden;
  font-size: 3cqw;
  line-height: 1.2;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.ah-sp-thumb,
.ah-sp-liked {
  display: flex;
  width: 12cqw;
  height: 12cqw;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
}

.ah-sp-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.ah-sp-thumb.is-round img {
  width: 10.4cqw;
  height: 10.4cqw;
  border-radius: 50%;
}

.ah-sp-liked {
  background: linear-gradient(135deg, #450af5, #8e8ee5 60%, #c4efd9);
  --i: 5cqw;
}

/* 正在播放的小绿色律动条 */
.ah-sp-eq {
  display: flex;
  height: 3cqw;
  align-items: flex-end;
  gap: 0.5cqw;
}

.ah-sp-eq i {
  width: 0.7cqw;
  height: 30%;
  border-radius: 0.3cqw;
  background: #1ed760;
}

.ah-sp-eq.is-on i {
  animation: ah-eq 0.9s ease-in-out infinite alternate;
}

.ah-sp-eq.is-on i:nth-child(2) { animation-delay: -0.3s; }
.ah-sp-eq.is-on i:nth-child(3) { animation-delay: -0.6s; }

@keyframes ah-eq {
  from { height: 25%; }
  to { height: 100%; }
}

.ah-sp-h {
  padding: 6cqw 4cqw 3cqw;
  font-size: 5.2cqw;
  font-weight: 800;
  letter-spacing: -0.01em;
}

.ah-sp-cards {
  display: flex;
  gap: 3cqw;
  overflow: hidden;
  padding: 0 4cqw;
}

.ah-sp-card {
  width: 34cqw;
  flex-shrink: 0;
}

.ah-sp-card > img,
.ah-sp-mix {
  display: block;
  width: 100%;
  aspect-ratio: 1;
  border-radius: 1cqw;
  object-fit: cover;
}

.ah-sp-card b,
.ah-sp-card small {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ah-sp-card b {
  margin-top: 2cqw;
  font-size: 3cqw;
}

.ah-sp-card small {
  margin-top: 0.6cqw;
  color: #b3b3b3;
  font-size: 2.7cqw;
}

.ah-sp-mix {
  position: relative;
  overflow: hidden;
}

.ah-sp-mix img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.ah-sp-mix i {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 1.4cqw 2cqw;
  background: var(--mix);
  font-size: 2.8cqw;
  font-style: normal;
  font-weight: 800;
}

.ah-sp-mini {
  position: absolute;
  left: 2cqw;
  right: 2cqw;
  bottom: 13cqw;
  display: flex;
  height: 12.4cqw;
  align-items: center;
  gap: 3cqw;
  overflow: hidden;
  padding: 0 3cqw 0 1.6cqw;
  border-radius: 1.8cqw;
  background: color-mix(in srgb, var(--tint) 55%, #3a3a3a);
  font-size: 3cqw;
  line-height: 1.3;
  --i: 5.6cqw;
}

.ah-sp-mini > img {
  width: 9cqw;
  height: 9cqw;
  flex-shrink: 0;
  border-radius: 0.8cqw;
  object-fit: cover;
}

.ah-sp-mini span.block {
  color: rgba(255, 255, 255, 0.7);
}

.ah-sp-mini-bar {
  position: absolute;
  left: 2cqw;
  right: 2cqw;
  bottom: 0;
  height: 0.5cqw;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.25);
}

.ah-sp-mini-bar i {
  display: block;
  width: 32%;
  height: 100%;
  border-radius: inherit;
  background: #fff;
}

.ah-sp-nav {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  height: 12cqw;
  justify-content: space-around;
  padding-top: 1.6cqw;
  background: linear-gradient(180deg, rgba(0, 0, 0, 0.75), #000 40%);
  color: #b3b3b3;
  font-size: 2.5cqw;
  --i: 5.6cqw;
}

.ah-sp-nav > span {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.8cqw;
}

.ah-sp-nav .is-on {
  color: #fff;
}

/* 正在播放页：从底部滑上来盖住首页 */
.ah-sp-np {
  position: absolute;
  inset: 0;
  z-index: 3;
  overflow: hidden;
  transform: translateY(105%);
  transition: transform 0.5s cubic-bezier(0.2, 0.8, 0.2, 1);
}

.ah-sp-np.is-open {
  transform: none;
}

/* ---------- Telegram（iOS） ---------- */
.ah-tg {
  background: #fff;
  color: #000;
}

.ah-glass {
  display: flex;
  align-items: center;
  border: 1px solid rgba(255, 255, 255, 0.7);
  background: rgba(255, 255, 255, 0.72);
  box-shadow: 0 0.6cqw 2.4cqw rgba(0, 0, 0, 0.08);
  backdrop-filter: blur(10px);
}

.ah-tg-list,
.ah-tg-chat {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  padding-top: 9cqw;
  transition: transform 0.45s cubic-bezier(0.2, 0.8, 0.2, 1), filter 0.45s ease;
}

.ah-tg-list.is-away {
  filter: brightness(0.9);
  transform: translateX(-28%);
}

.ah-tg-top {
  display: flex;
  height: 12cqw;
  flex-shrink: 0;
  align-items: center;
  gap: 2cqw;
  padding: 0 3cqw;
  --i: 5.2cqw;
}

.ah-tg-edit {
  height: 9cqw;
  padding: 0 3.6cqw;
  border-radius: 999px;
  font-size: 3.4cqw;
}

.ah-tg-title {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  gap: 1.6cqw;
  font-size: 3.8cqw;
  font-weight: 600;
}

.ah-tg-logo {
  display: flex;
  width: 7cqw;
  height: 7cqw;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: linear-gradient(180deg, #37aee2, #1e96c8);
  color: #fff;
  --i: 4cqw;
}

.ah-tg-pair {
  height: 9cqw;
  gap: 3cqw;
  padding: 0 3cqw;
  border-radius: 999px;
}

.ah-tg-compose {
  display: flex;
  width: 9.4cqw;
  height: 9.4cqw;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: #3478f6;
  color: #fff;
}

.ah-tg-search {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  gap: 1.4cqw;
  margin: 1cqw 3cqw 2.4cqw;
  padding: 2.2cqw 0;
  border-radius: 999px;
  background: #ebebed;
  color: #8e8e93;
  font-size: 3.4cqw;
  --i: 4.2cqw;
}

.ah-tg-row {
  display: flex;
  align-items: center;
  gap: 2.8cqw;
  padding: 0 3cqw 0 3.4cqw;
  transition: background-color 0.15s ease;
}

.ah-tg-row.is-pinned {
  background: #f2f2f7;
}

.ah-tg-row.is-last-pin {
  border-bottom: 1px solid #d1d1d6;
}

.ah-tg-row.is-tapping {
  background: #d9d9de;
}

.ah-tg-av {
  display: flex;
  width: 13cqw;
  height: 13cqw;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  object-fit: cover;
}

.ah-tg-av.is-initials {
  color: #fff;
  font-size: 5cqw;
  font-weight: 600;
}

.ah-tg-main {
  min-width: 0;
  flex: 1;
  padding: 2.2cqw 0;
  border-bottom: 1px solid #e5e5ea;
}

.ah-tg-row.is-last-pin .ah-tg-main,
.ah-tg-row:has(+ .ah-tg-row.is-tapping) .ah-tg-main {
  border-bottom-color: transparent;
}

.ah-tg-l1 {
  display: flex;
  align-items: center;
  gap: 1cqw;
}

.ah-tg-l1 b {
  overflow: hidden;
  font-size: 3.6cqw;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ah-tg-l1 small {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 0.6cqw;
  color: #8e8e93;
  font-size: 2.9cqw;
  --i: 3.8cqw;
}

.ah-tg-mute {
  color: #aeaeb2;
  --i: 3.2cqw;
}

.ah-tg-tick {
  color: #3478f6;
}

.ah-tg-l2 {
  display: flex;
  align-items: center;
  gap: 2cqw;
  margin-top: 0.4cqw;
}

.ah-tg-preview {
  min-width: 0;
  flex: 1;
  color: #8e8e93;
  font-size: 3.2cqw;
  line-height: 1.32;
}

.ah-tg-preview > b {
  display: block;
  overflow: hidden;
  color: #000;
  font-weight: 400;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ah-tg-preview > span {
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.ah-tg-preview > span.is-one {
  -webkit-line-clamp: 1;
}

.ah-tg-preview .is-typing {
  color: #3478f6;
}

.ah-tg-badge {
  display: flex;
  min-width: 5cqw;
  height: 5cqw;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  padding: 0 1.5cqw;
  border-radius: 999px;
  background: #3478f6;
  color: #fff;
  font-size: 2.9cqw;
  font-style: normal;
}

.ah-tg-badge.is-muted {
  background: #aeaeb2;
}

.ah-tg-pin {
  color: #aeaeb2;
  transform: rotate(40deg);
  --i: 4cqw;
}

.ah-tg-tabs {
  position: absolute;
  left: 4cqw;
  right: 4cqw;
  bottom: 2cqw;
  display: flex;
  height: 14cqw;
  align-items: center;
  justify-content: space-around;
  padding: 0 1.4cqw;
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.86);
  box-shadow: 0 1.4cqw 5cqw rgba(0, 0, 0, 0.12);
  backdrop-filter: blur(12px);
  font-size: 2.6cqw;
  font-weight: 500;
  --i: 6cqw;
}

.ah-tg-tabs > span {
  position: relative;
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  gap: 0.6cqw;
  padding: 1.4cqw 0;
  border-radius: 999px;
}

.ah-tg-tabs > span.is-on {
  background: #ececee;
  color: #3478f6;
}

.ah-tg-tabs i {
  position: absolute;
  top: 0;
  left: 54%;
  display: flex;
  min-width: 4.6cqw;
  height: 4.6cqw;
  align-items: center;
  justify-content: center;
  padding: 0 1.2cqw;
  border-radius: 999px;
  background: #ff3b30;
  color: #fff;
  font-size: 2.8cqw;
  font-style: normal;
}

/* 对话页 */
.ah-tg-chat {
  z-index: 2;
  background:
    radial-gradient(circle, rgba(255, 255, 255, 0.16) 0.5cqw, transparent 0.7cqw) 0 0 / 7cqw 7cqw,
    radial-gradient(circle at 15% 8%, #dce6a8 0, transparent 55%),
    radial-gradient(circle at 85% 70%, #9fcb98 0, transparent 60%),
    linear-gradient(165deg, #c9dd9f, #96c48f 50%, #7db592);
  transform: translateX(102%);
  box-shadow: -2cqw 0 6cqw rgba(0, 0, 0, 0.12);
}

.ah-tg-chat.is-open {
  transform: none;
}

.ah-tg-chathead {
  display: flex;
  height: 13cqw;
  flex-shrink: 0;
  align-items: center;
  gap: 3cqw;
  padding: 0 3cqw;
}

.ah-tg-back {
  width: 10cqw;
  height: 10cqw;
  flex-shrink: 0;
  justify-content: center;
  border-radius: 50%;
  --i: 5.4cqw;
}

.ah-tg-who {
  min-width: 0;
  flex: 1;
  flex-direction: column;
  justify-content: center;
  height: 10.6cqw;
  border-radius: 999px;
  line-height: 1.25;
}

.ah-tg-who b {
  display: flex;
  align-items: center;
  gap: 0.8cqw;
  font-size: 3.6cqw;
  --i: 3cqw;
}

.ah-tg-who b .ah-i {
  color: #8e8e93;
}

.ah-tg-who small {
  max-width: 92%;
  overflow: hidden;
  color: #6d6d72;
  font-size: 2.7cqw;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ah-tg-who small.is-typing {
  color: #3478f6;
}

.ah-tg-gav {
  width: 10cqw;
  height: 10cqw;
  flex-shrink: 0;
  border: 0.6cqw solid #fff;
  border-radius: 50%;
  object-fit: cover;
}

.ah-tg-pinbar {
  flex-shrink: 0;
  gap: 2.4cqw;
  margin: 0.6cqw 3cqw 2cqw;
  padding: 1.8cqw 3.4cqw;
  border-radius: 999px;
  color: #8e8e93;
  font-size: 3cqw;
  line-height: 1.3;
  --i: 4cqw;
}

.ah-tg-pinbar > i {
  width: 0.7cqw;
  height: 7cqw;
  flex-shrink: 0;
  border-radius: 999px;
  background: #000;
}

.ah-tg-pinbar b {
  display: block;
  color: #000;
  font-weight: 600;
}

.ah-tg-pinbar span {
  display: block;
  overflow: hidden;
  color: #000;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ah-tg-msgs {
  position: relative;
  min-height: 0;
  flex: 1;
  overflow: hidden;
}

.ah-tg-thread {
  display: flex;
  flex-direction: column;
  gap: 0.8cqw;
  padding-bottom: 2cqw;
  transition: transform 1.2s cubic-bezier(0.25, 0.75, 0.3, 1);
}

.ah-tg-unread {
  margin-bottom: 1.4cqw;
  padding: 1.2cqw 0;
  background: rgba(255, 255, 255, 0.55);
  color: #6d6d72;
  font-size: 3cqw;
  text-align: center;
}

.ah-tg-msg {
  display: flex;
  align-items: flex-end;
  gap: 1.6cqw;
  padding: 0 14cqw 0 2cqw;
}

.ah-tg-msg.is-first {
  margin-top: 1cqw;
}

.ah-tg-slot {
  width: 8.4cqw;
  height: 8.4cqw;
  flex-shrink: 0;
}

.ah-tg-slot > * {
  display: flex;
  width: 100%;
  height: 100%;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  color: #fff;
  font-size: 3.2cqw;
  font-weight: 600;
  object-fit: cover;
}

.ah-tg-bubble {
  min-width: 0;
  max-width: 100%;
  padding: 1.6cqw 3cqw 1.4cqw;
  border-radius: 4cqw;
  background: #fff;
  font-size: 3.4cqw;
  line-height: 1.35;
}

.ah-tg-msg:not(.is-last) .ah-tg-bubble {
  border-bottom-left-radius: 1.4cqw;
}

.ah-tg-msg:not(.is-first) .ah-tg-bubble {
  border-top-left-radius: 1.4cqw;
}

.ah-tg-bubble.has-img {
  overflow: hidden;
  padding: 0 0 1.4cqw;
}

.ah-tg-bubble.has-img .ah-tg-text {
  padding: 1.4cqw 3cqw 0;
}

.ah-tg-photo {
  display: block;
  width: 56cqw;
  aspect-ratio: 4 / 3;
  object-fit: cover;
}

.ah-tg-from {
  display: flex;
  align-items: center;
  gap: 2cqw;
  margin-bottom: 0.4cqw;
  font-size: 3.2cqw;
  font-weight: 600;
}

.ah-tg-from em {
  margin-left: auto;
  padding: 0.2cqw 1.8cqw;
  border-radius: 999px;
  background: rgba(76, 162, 90, 0.14);
  color: #4ca25a;
  font-size: 2.7cqw;
  font-style: normal;
  font-weight: 500;
}

.ah-tg-reply {
  margin: 0.6cqw 0 1cqw;
  padding: 1cqw 2.4cqw;
  border-left: 0.8cqw solid var(--rc);
  border-radius: 1.2cqw;
  background: color-mix(in srgb, var(--rc) 11%, #fff);
  font-size: 3cqw;
  line-height: 1.3;
}

.ah-tg-reply b {
  display: block;
  color: var(--rc);
  font-weight: 600;
}

.ah-tg-reply span {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 时间贴在气泡右下角 */
.ah-tg-time {
  position: relative;
  top: 1cqw;
  display: inline-flex;
  float: right;
  align-items: center;
  margin-left: 2.4cqw;
  color: #8e8e93;
  font-size: 2.5cqw;
  --i: 3cqw;
}

.ah-tg-down {
  position: absolute;
  right: 3cqw;
  bottom: 17cqw;
  width: 10.4cqw;
  height: 10.4cqw;
  justify-content: center;
  border-radius: 50%;
  --i: 5.4cqw;
}

.ah-tg-down i {
  position: absolute;
  top: -3cqw;
  left: 50%;
  padding: 0.2cqw 1.6cqw;
  border-radius: 999px;
  background: #3478f6;
  color: #fff;
  font-size: 2.8cqw;
  font-style: normal;
  transform: translateX(-50%);
}

.ah-tg-input {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 2cqw;
  padding: 1.4cqw 3cqw 2.6cqw;
  --i: 5.2cqw;
}

.ah-tg-circle {
  width: 10.4cqw;
  height: 10.4cqw;
  flex-shrink: 0;
  justify-content: center;
  border-radius: 50%;
}

.ah-tg-field {
  height: 10.4cqw;
  flex: 1;
  gap: 2.6cqw;
  padding: 0 3.4cqw;
  border-radius: 999px;
  color: #8e8e93;
  font-size: 3.4cqw;
  --i: 4.8cqw;
}
</style>
