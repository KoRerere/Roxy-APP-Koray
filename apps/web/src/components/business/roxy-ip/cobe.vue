<script setup lang="ts">
import createGlobe from 'cobe'
import type { Arc, Globe, Marker } from 'cobe'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, useId, watch } from 'vue'
import { RxSvgIcon } from '/@/components/rx-icon'
import type { SvgNames } from '/@/components/rx-icon'
import { useThemeStore } from '/@/stores/theme'

const themeStore = useThemeStore()

/** cobe 球体/地图点配色（随 light / dark 切换） */
interface GlobeAppearance {
  dark: number
  baseColor: [number, number, number]
  glowColor: [number, number, number]
  mapBrightness: number
  mapBaseBrightness: number
}

/** 暗色球体底色 #010101 → cobe 0–1 RGB */
const GLOBE_DARK_BASE_RGB: [number, number, number] = [1 / 255, 1 / 255, 1 / 255]
/** 暗色地图点 #BFBFC1 → cobe 0–1 RGB */
const GLOBE_DARK_DOT_RGB: [number, number, number] = [191 / 255, 191 / 255, 193 / 255]
/** 暗色亮点 ≈ baseColor * (mapBrightness + 0.1)，取 0.9 使峰值接近 #BFBFC1 */
const GLOBE_DARK_MAP_BRIGHTNESS = 0.9

function getGlobeAppearance(isDark: boolean): GlobeAppearance {
  if (isDark) {
    return {
      dark: 1,
      baseColor: GLOBE_DARK_DOT_RGB,
      glowColor: GLOBE_DARK_BASE_RGB,
      mapBrightness: GLOBE_DARK_MAP_BRIGHTNESS,
      mapBaseBrightness: 0,
    }
  }
  return {
    dark: 0,
    baseColor: [1, 1, 1],
    glowColor: [1, 1, 1],
    mapBrightness: 10,
    mapBaseBrightness: 0,
  }
}

const globeAppearance = computed(() => getGlobeAppearance(themeStore.isDarkTheme))

const canvasRef = ref<HTMLCanvasElement | null>(null)
const globeShellRef = ref<HTMLDivElement | null>(null)
/** SVG textPath 需全局唯一 id（页面上多块 globe 时） */
const orbitPathId = `cobe-orbit-${useId().replace(/[^\w-]/g, '')}`
const labelHostRef = ref<HTMLDivElement | null>(null)
const globeRef = shallowRef<Globe | null>(null)
const teleportTarget = shallowRef<HTMLElement | null>(null)
const PHI_STEP = 0.0028
const THETA_BASE = 0.65
/** 初始水平角：正面朝中国区（约 105°E，与当前 THETA_BASE 匹配） */
const PHI_BASE = 2.35
/** 与 Figma「圆环文字」一致的环形文案 */
const ORBIT_REPEAT_PHRASE = 'High-Reputation Global Proxies Trusted by 3M+ Cross-Border Professionals · '
const orbitTickerText = ORBIT_REPEAT_PHRASE.repeat(3)

type ArcDef = Arc & { fromId: string, toId: string, label: string }

/** cobe Marker.color 为 0–1，与标签背景 / 箭头共用 */
function markerLabelAccentStyle(rgb: NonNullable<Marker['color']>) {
  const [r, g, b] = rgb.map(c => Math.round(Math.min(1, Math.max(0, c)) * 255))
  return { '--cobe-marker-lbl-accent': `rgb(${r} ${g} ${b})` }
}

/** 颜色按 Figma 高亮标签；其余为次要节点 */
const markerDefs: (Marker & { label: string })[] = [
  { id: 'US', location: [38.8951, -77.0364], size: 0.042, color: [0.95, 0.32, 0.42], label: '16.2M+IPs' },
  { id: 'CA', location: [45.4215, -75.6972], size: 0.036, color: [0.14, 0.42, 0.96], label: '10.1M+IPs' },
  { id: 'MX', location: [19.4326, -99.1332], size: 0.034, color: [0.62, 0.92, 0.28], label: '7.6M+IPs' },
  { id: 'HK', location: [22.3193, 114.1694], size: 0.036, color: [0.15, 0.88, 0.95], label: '5.8M+IPs' },
  { id: 'JP', location: [35.6762, 139.6503], size: 0.04, color: [0.98, 0.52, 0.78], label: '4.9M+IPs' },
  { id: 'AE', location: [24.4539, 54.3773], size: 0.035, color: [0.96, 0.62, 0.38], label: '4.3M+IPs' },
  { id: 'SG', location: [1.3521, 103.8198], size: 0.04, color: [0.98, 0.48, 0.14], label: '3.8M+IPs' },
  { id: 'KR', location: [37.5665, 126.9780], size: 0.038, color: [0.78, 0.22, 0.68], label: '3.4M+IPs' },
  { id: 'ID', location: [-6.2088, 106.8456], size: 0.035, color: [0.12, 0.74, 0.48], label: '3.1M+IPs' },
  { id: 'PH', location: [14.5995, 120.9842], size: 0.034, color: [0.58, 0.95, 0.66], label: '2.8M+IPs' },
  { id: 'IN', location: [28.6139, 77.2090], size: 0.039, color: [0.92, 0.62, 0.88], label: '2.55M+IPs' },
  { id: 'TH', location: [13.7563, 100.5018], size: 0.034, color: [0.48, 0.28, 0.92], label: '2.35M+IPs' },
  { id: 'GB', location: [51.5072, -0.1276], size: 0.038, color: [0.38, 0.58, 0.52], label: '2.1M+IPs' },
  { id: 'FR', location: [48.8566, 2.3522], size: 0.036, color: [0.9, 0.24, 0.38], label: '1.9M+IPs' },
  { id: 'DE', location: [52.5200, 13.4050], size: 0.036, color: [0.95, 0.76, 0.22], label: '1.7M+IPs' },
  { id: 'IT', location: [41.9028, 12.4964], size: 0.034, color: [0.2, 0.82, 0.42], label: '1.5M+IPs' },
  { id: 'ES', location: [40.4168, -3.7038], size: 0.034, color: [0.52, 0.55, 0.96], label: '1.3M+IPs' },
  { id: 'AU', location: [-35.2809, 149.1300], size: 0.035, color: [0.68, 0.86, 0.98], label: '1.1M+IPs' },
  { id: 'BR', location: [-15.7939, -47.8828], size: 0.035, color: [0.18, 0.88, 0.52], label: '0.85M+IPs' },
  { id: 'ZA', location: [-25.7479, 28.2293], size: 0.032, color: [0.72, 0.48, 0.34], label: '0.65M+IPs' },
]

const arcDefsBase: Omit<ArcDef, 'label'>[] = [
  { id: 'US-JP', fromId: 'US', toId: 'JP', from: [38.8951, -77.0364], to: [35.6762, 139.6503], color: [0.55, 0.75, 1] },
  { id: 'GB-US', fromId: 'GB', toId: 'US', from: [51.5072, -0.1276], to: [38.8951, -77.0364], color: [0.95, 0.55, 0.5] },
  { id: 'AE-SG', fromId: 'AE', toId: 'SG', from: [24.4539, 54.3773], to: [1.3521, 103.8198], color: [0.75, 0.6, 1] },
  { id: 'SG-AU', fromId: 'SG', toId: 'AU', from: [1.3521, 103.8198], to: [-35.2809, 149.1300], color: [0.45, 0.9, 0.85] },
  { id: 'JP-AU', fromId: 'JP', toId: 'AU', from: [35.6762, 139.6503], to: [-35.2809, 149.1300], color: [0.5, 0.95, 0.65] },
  { id: 'BR-US', fromId: 'BR', toId: 'US', from: [-15.7939, -47.8828], to: [38.8951, -77.0364], color: [1, 0.75, 0.45] },
  { id: 'DE-JP', fromId: 'DE', toId: 'JP', from: [52.5200, 13.4050], to: [35.6762, 139.6503], color: [0.9, 0.65, 0.85] },
  { id: 'ZA-GB', fromId: 'ZA', toId: 'GB', from: [-25.7479, 28.2293], to: [51.5072, -0.1276], color: [0.65, 0.7, 1] },
]

const arcDefs: ArcDef[] = arcDefsBase.map(row => ({
  ...row,
  label: `${row.fromId} → ${row.toId}`,
}))

const markers: Marker[] = markerDefs.map(({ label: _l, ...m }) => m)
/** 仅传 cobe 支持的字段；弧中点锚点为 `--cobe-arc-${id}`，与文档一致 */
const arcs: Arc[] = arcDefs.map(({ label: _l, fromId: _f, toId: _t, ...a }) => a)

let cobeVisibilityStyleEl: HTMLStyleElement | null = null

function patchCobeVisibleVars() {
  if (!cobeVisibilityStyleEl) {
    cobeVisibilityStyleEl = Array.from(document.querySelectorAll('style')).find(s =>
      s.textContent?.includes('--cobe-visible-'),
    ) ?? null
  }
  const el = cobeVisibilityStyleEl
  if (!el?.textContent?.includes(':N'))
    return
  el.textContent = el.textContent.replace(/(--cobe-visible(?:-arc)?-[^:]+):N\b/g, '$1:1')
}

function readAnchorName(el: HTMLElement): string | null {
  const raw = el.style.getPropertyValue('anchor-name') || el.style.cssText.match(/anchor-name:\s*([^;]+)/i)?.[1]
  return raw ? String(raw).trim() : null
}

function resolveVisibleCssVar(varName: string): number {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(varName).trim()
  if (raw === '1' || raw === 'N')
    return 1
  const n = Number.parseFloat(raw)
  return Number.isFinite(n) ? n : 0
}

/**
 * 不依赖 CSS Anchor API：按 cobe 写入的 1×1 锚点 div 贴标签。
 * 注意：createGlobe 会在 canvas 外包一层 position:relative 的 div，锚点挂在该层上（见 cobe 源码 insertBefore + append），
 * 必须用 canvas.parentElement 遍历，不能用更外层的 globeShellRef。
 */
function syncDomLabels(anchorRoot: HTMLElement, host: HTMLElement) {
  const hr = host.getBoundingClientRect()

  for (const m of markerDefs) {
    const el = host.querySelector(`[data-lbl="m-${m.id}"]`) as HTMLElement | null
    if (!el)
      continue
    const want = `--cobe-${m.id}`
    let anchor: HTMLElement | null = null
    for (let i = 0; i < anchorRoot.children.length; i++) {
      const c = anchorRoot.children[i]!
      if (c === host || c.tagName === 'CANVAS')
        continue
      if (c.tagName !== 'DIV')
        continue
      const name = readAnchorName(c as HTMLElement)
      if (name === want) {
        anchor = c as HTMLElement
        break
      }
    }
    if (!anchor) {
      el.style.opacity = '0'
      continue
    }
    const ar = anchor.getBoundingClientRect()
    const cx = ar.left + ar.width / 2 - hr.left
    const top = ar.top - hr.top
    el.style.left = `${cx}px`
    el.style.top = `${top}px`
    el.style.transform = 'translate(-50%, calc(-100% - 8px))'
    el.style.opacity = String(resolveVisibleCssVar(`--cobe-visible-${m.id}`))
  }

  for (const a of arcDefs) {
    const el = host.querySelector(`[data-lbl="a-${a.id}"]`) as HTMLElement | null
    if (!el)
      continue
    const want = `--cobe-arc-${a.id}`
    let anchor: HTMLElement | null = null
    for (let i = 0; i < anchorRoot.children.length; i++) {
      const c = anchorRoot.children[i]!
      if (c === host || c.tagName === 'CANVAS')
        continue
      if (c.tagName !== 'DIV')
        continue
      const name = readAnchorName(c as HTMLElement)
      if (name === want) {
        anchor = c as HTMLElement
        break
      }
    }
    if (!anchor) {
      el.style.opacity = '0'
      continue
    }
    const ar = anchor.getBoundingClientRect()
    const cx = ar.left + ar.width / 2 - hr.left
    const top = ar.top - hr.top
    el.style.left = `${cx}px`
    el.style.top = `${top}px`
    // 弧中点：标签略靠上，避免与弧线重叠
    el.style.transform = 'translate(-50%, calc(-100% - 10px))'
    el.style.opacity = String(resolveVisibleCssVar(`--cobe-visible-arc-${a.id}`))
  }
}

function globeDpr() {
  return Math.min(
    globalThis.devicePixelRatio || 1,
    globalThis.innerWidth < 640 ? 1.8 : 2,
  )
}

function readGlobeLogicalSize(canvas: HTMLCanvasElement) {
  const w = canvas.offsetWidth
  return w > 0 ? w : Math.min(820, globalThis.innerWidth - 32)
}

let rafId = 0
/** 自动旋转累加角（从 PHI_BASE 起算） */
let phiAuto = PHI_BASE

let resizeObserver: ResizeObserver | null = null
let resizeRafId = 0
let lastGlobeLogicalSize = 0

function scheduleGlobeResize() {
  if (resizeRafId)
    return
  resizeRafId = requestAnimationFrame(() => {
    resizeRafId = 0
    const g = globeRef.value
    const canvas = canvasRef.value
    if (!g || !canvas)
      return
    const next = readGlobeLogicalSize(canvas)
    if (next <= 0 || next === lastGlobeLogicalSize)
      return
    lastGlobeLogicalSize = next
    g.update({ width: next, height: next })
  })
}

async function initGlobe() {
  await nextTick()
  await new Promise<void>(r => requestAnimationFrame(() => r()))
  const canvas = canvasRef.value
  if (!canvas)
    return

  const logical = readGlobeLogicalSize(canvas)
  const dpr = globeDpr()
  const appearance = globeAppearance.value

  const globe = createGlobe(canvas, {
    devicePixelRatio: dpr,
    width: logical,
    height: logical,
    phi: PHI_BASE,
    theta: THETA_BASE,
    ...appearance,
    diffuse: 1.5,
    scale: 1.2,
    mapSamples: 16000,
    markerColor: [0.3, 0.45, 0.85],
    offset: [90, 60],
    markers,
    arcs,
    arcColor: [0.5, 0.75, 1],
    arcWidth: 0.42,
    arcHeight: 0.3,
    markerElevation: 0,
  })

  globeRef.value = globe
  lastGlobeLogicalSize = logical

  await nextTick()
  const shell = globeShellRef.value ?? canvas.parentElement
  teleportTarget.value = shell
  patchCobeVisibleVars()

  resizeObserver = new ResizeObserver(() => {
    scheduleGlobeResize()
  })
  resizeObserver.observe(canvas)

  const loop = () => {
    phiAuto += PHI_STEP
    globe.update({
      phi: phiAuto,
      theta: THETA_BASE,
    })
    patchCobeVisibleVars()
    const anchorRoot = canvas.parentElement
    const host = labelHostRef.value
    if (anchorRoot && host)
      syncDomLabels(anchorRoot, host)
    rafId = requestAnimationFrame(loop)
  }
  rafId = requestAnimationFrame(loop)
}

watch(globeAppearance, (appearance) => {
  globeRef.value?.update(appearance)
})

onMounted(() => {
  void initGlobe()
})

onBeforeUnmount(() => {
  cancelAnimationFrame(rafId)
  if (resizeRafId) {
    cancelAnimationFrame(resizeRafId)
    resizeRafId = 0
  }
  resizeObserver?.disconnect()
  resizeObserver = null
  teleportTarget.value = null
  cobeVisibilityStyleEl = null
  globeRef.value?.destroy()
  globeRef.value = null
})
</script>

<template>
  <div class="cobe-stack">
    <div class="cobe-wrap relative">
      <div ref="globeShellRef" class="cobe-globe-shell relative z-2">
        <canvas ref="canvasRef" class="cobe-canvas" />
        <div class="cobe-orbit-ring" aria-hidden="true">
          <svg class="cobe-orbit-svg" viewBox="0 0 100 100">
            <defs>
              <path :id="orbitPathId" d="M 50,50 m -46,0 a 46,46 0 1,1 92,0 a 46,46 0 1,1 -92,0" />
            </defs>
            <text class="cobe-orbit-text text-1 md:text-0.75" dominant-baseline="middle">
              <textPath :href="`#${orbitPathId}`" startOffset="0%">
                {{ orbitTickerText }}
              </textPath>
            </text>
          </svg>
        </div>
        <!-- <div class="cobe-globe-overlay">
          <h1 class="cobe-brand-title">
            ROXY
          </h1>
        </div> -->
        <Teleport v-if="teleportTarget" :to="teleportTarget">
          <div ref="labelHostRef" class="cobe-label-host">
            <span
              v-for="m in markerDefs"
              :key="m.id"
              class="marker-lbl"
              :data-lbl="`m-${m.id}`"
              :style="m.color ? markerLabelAccentStyle(m.color) : undefined"
            >
              <span class="cobe-lbl-body">
                <span class="cobe-lbl-flag">
                  <RxSvgIcon
                    :name="(`country-code/${m.id}` as SvgNames)"
                    fallback="base/rx_ic_earth"
                    size="24"
                  />
                </span>
                <span class="cobe-lbl-text">{{ m.label }}</span>
              </span>
              <span class="cobe-lbl-arrow" aria-hidden="true" />
            </span>
            <!-- <span
              v-for="a in arcDefs"
              :key="a.id"
              class="arc-lbl arc-label"
              :data-lbl="`a-${a.id}`"
            >
              <span class="cobe-lbl-body cobe-lbl-body--arc">
                <span class="cobe-lbl-text">{{ a.label }}</span>
              </span>
              <span class="cobe-lbl-arrow" aria-hidden="true" />
            </span> -->
          </div>
        </Teleport>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cobe-stack {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: flex-end;
  justify-content: flex-end;
}

.cobe-bg {
  width: 60%;
  height: 100%;
  right: 0;
  background: linear-gradient(144deg, #42a3fe -18.6%, #00d188 100%);
  z-index: 1;
  border-radius: 24px;
}

.cobe-wrap {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: flex-end;
  justify-content: flex-end;
}

.cobe-globe-shell {
  box-sizing: border-box;
  /* width: min(820px, 100%); */
  /* height: auto; */
  height: 100%;
  aspect-ratio: 1;
  /* max-height: min(820px, 100%); */
  margin: 0;
  margin-left: auto;
  flex-shrink: 0;
  position: relative;
  overflow: visible;
  perspective: 700px;
  transform-style: preserve-3d;
  contain: layout style;
  user-select: none;
}

.cobe-decorative-arcs {
  position: absolute;
  left: 10.4%;
  top: 8.5%;
  width: 78.5%;
  height: 65.2%;
  pointer-events: none;
  z-index: 4;
  object-fit: contain;
}

.cobe-orbit-ring {
  position: absolute;
  /* 球体贴右后，环文字向左展开 */
  inset: -2% 14% -8% -22%;
  pointer-events: none;
  z-index: 5;
  transform: translate(148px, 38px) scale(1.2);
  transform-origin: 62% 74%;
  mask-image: linear-gradient(to bottom, rgb(0 0 0 / 6%) 34%, #000 42%, #000 100%);
  -webkit-mask-image: linear-gradient(to bottom, rgb(0 0 0 / 6%) 34%, #000 42%, #000 100%);
}

.cobe-orbit-svg {
  width: 100%;
  height: 100%;
  overflow: visible;
  transform: rotateX(62deg);
  animation:
    cobe-orbit-spin 30s linear infinite,
    cobe-fade-in 1.7s ease 0.5s both;
}

.cobe-orbit-text {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  fill: rgb(0 0 0 / 35%);
  letter-spacing: 0.14em;
  text-transform: uppercase;
  font-size: 3.2px;
}

[data-theme='dark'] .cobe-orbit-text {
  fill: rgb(255 255 255 / 40%) !important;
}

.cobe-globe-overlay {
  position: absolute;
  inset: 0;
  z-index: 6;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  animation: cobe-fade-in 1.5s ease 0.2s both;
}

/**
 * 官网使用自定义像素线字体；此处用渐变模拟横向条纹字效（见 COBE 演示）
 */
.cobe-brand-title {
  margin: 0;
  line-height: 1;
  letter-spacing: 0.15em;
  text-indent: 0.15em;
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-weight: 800;
  font-size: min(16vw, 4.5rem);
  background: repeating-linear-gradient(
    180deg,
    rgb(51, 102, 255) 0,
    rgb(51, 102, 255) 3px,
    transparent 3px,
    transparent 6px
  );
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  paint-order: stroke fill;
}

@keyframes cobe-orbit-spin {
  from {
    transform: rotateX(62deg) rotateZ(0deg);
  }

  to {
    transform: rotateX(62deg) rotateZ(-360deg);
  }
}

@keyframes cobe-fade-in {
  from {
    opacity: 0;
  }

  to {
    opacity: 1;
  }
}

.cobe-label-host {
  position: absolute;
  inset: 0;
  z-index: 6;
  pointer-events: none;
}

.cobe-canvas {
  position: relative;
  z-index: 1;
  display: block;
  width: 100%;
  height: 100%;
}

.marker-lbl,
.arc-lbl.arc-label {
  position: absolute;
  left: 0;
  top: 0;
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  max-width: min(220px, 45vw);
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  pointer-events: none;
  transition: opacity 0.2s ease;
  will-change: transform, opacity;
  overflow: visible;
}

.arc-lbl.arc-label {
  max-width: min(200px, 50vw);
  transition: opacity 0.3s ease;
  z-index: 1;
}

.cobe-lbl-body {
  display: flex;
  align-items: center;
  gap: 9px;
  width: 100%;
  min-height: 43px;
  padding: 6px 12px;
  background: var(--cobe-marker-lbl-accent, #1a1a1a);
  color: #fff;
  border-radius: 6px;
  font-weight: 500;
  box-sizing: border-box;
  box-shadow:
    0 6.154px 3.077px rgb(0 0 0 / 2%),
    0 1.538px 0.769px rgb(0 0 0 / 6%);
}

.cobe-lbl-flag {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 25px;
  height: 25px;
  border: 1.5px solid #fff;
  border-radius: 50%;
  overflow: hidden;
  background: #fff;
}

.cobe-lbl-body--arc {
  padding: 0.25rem 0.45rem;
  font-size: 0.7rem;
}

.cobe-lbl-text {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #fff;
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: clamp(12px, 1.65vw, 14px);
  font-weight: 500;
  line-height: 1.4;
}

.cobe-lbl-arrow {
  width: 0;
  height: 0;
  margin-top: -1px;
  border-left: 5px solid transparent;
  border-right: 5px solid transparent;
  border-top: 6px solid var(--cobe-marker-lbl-accent, #1a1a1a);
  flex-shrink: 0;
}
</style>
