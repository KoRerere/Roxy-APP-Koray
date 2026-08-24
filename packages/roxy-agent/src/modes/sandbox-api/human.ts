/**
 * `@roxybrowser/sandbox/human` — explicit, time-based browser interaction.
 *
 * The module stays dependency-free by describing only the Playwright surface it
 * needs. A real Playwright `Page` and `Locator` are structurally compatible.
 */

export type HumanRange = readonly [min: number, max: number]
export type HumanTypeMode = 'replace' | 'append'
export type HumanScrollAxis = 'horizontal' | 'vertical'
export type HumanMotionCurveName = 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out'
export type HumanMotionCurveFunction = (progress: number) => number
export type HumanMotionCurve = HumanMotionCurveName | HumanMotionCurveFunction
export type HumanScrollCurveName = HumanMotionCurveName
export type HumanScrollCurveFunction = HumanMotionCurveFunction
export type HumanScrollCurve = HumanMotionCurve

export interface HumanPoint {
  x: number
  y: number
}

export interface HumanBox extends HumanPoint {
  width: number
  height: number
}

export interface HumanPage {
  mouse: {
    wheel: (deltaX: number, deltaY: number) => Promise<void>
    move: (x: number, y: number, options?: { steps?: number }) => Promise<void>
    down: (options?: { button?: 'left' | 'middle' | 'right', clickCount?: number }) => Promise<void>
    up: (options?: { button?: 'left' | 'middle' | 'right', clickCount?: number }) => Promise<void>
  }
  keyboard: {
    type: (text: string, options?: { delay?: number }) => Promise<void>
    insertText: (text: string) => Promise<void>
    press: (key: string, options?: { delay?: number }) => Promise<void>
    down: (key: string) => Promise<void>
    up: (key: string) => Promise<void>
  }
}

export interface HumanTarget {
  boundingBox: () => Promise<HumanBox | null>
  scrollIntoViewIfNeeded: () => Promise<void>
}

export interface CreateHumanOptions {
  /** Playwright starts its synthetic mouse at the viewport origin by default. */
  initialPointer?: HumanPoint
}

export type HumanPointerPathFunction = (progress: number, start: HumanPoint, end: HumanPoint) => HumanPoint

export interface HumanBezierPath {
  type: 'bezier'
  /** Signed perpendicular offset from the direct line, in pixels. */
  curvature: number
}

export type HumanPointerPath = 'linear' | HumanBezierPath | HumanPointerPathFunction

export interface HumanPointerMotionOptions {
  duration: number
  curve: HumanMotionCurve
  path: HumanPointerPath
}

export interface HumanMoveOptions {
  target: HumanTarget | HumanPoint
  /** Position relative to a Locator's top-left corner. Default: exact center. */
  position?: HumanPoint
  /** Explicitly scroll a Locator into view before resolving its box. Default: false. */
  ensureVisible?: boolean
  motion: HumanPointerMotionOptions
}

export interface HumanHoverOptions extends HumanMoveOptions {
  dwellDuration: number
}

export interface HumanClickOptions extends HumanMoveOptions {
  button?: 'left' | 'middle' | 'right'
  settleDuration: number
  holdDuration: number
}

export type HumanTypeFocusOptions = Omit<HumanClickOptions, 'target'>

export interface HumanTypeOptions {
  target: HumanTarget
  text: string
  mode: HumanTypeMode
  /** Time allocated to all graphemes, excluding focus and clearing. */
  duration: number
  /** Must be monotonic because typed characters cannot move backwards. */
  curve: HumanMotionCurve
  /** Explicit click configuration, or false when the target is already focused. */
  focus: HumanTypeFocusOptions | false
}

export interface HumanPressOptions {
  key: string
  holdDuration: number
}

export interface HumanScrollOptions {
  /** Relative wheel distance in pixels. Positive means right/down; negative means left/up. */
  distance: number
  axis: HumanScrollAxis
  duration: number
  /** Maps normalized time to cumulative displacement; must start at `0` and end at `1`. */
  curve: HumanMotionCurve
}

export interface HumanPauseOptions {
  duration: number
}

export interface Human {
  move: (options: HumanMoveOptions) => Promise<void>
  hover: (options: HumanHoverOptions) => Promise<void>
  click: (options: HumanClickOptions) => Promise<void>
  type: (options: HumanTypeOptions) => Promise<void>
  press: (options: HumanPressOptions) => Promise<void>
  scroll: (options: HumanScrollOptions) => Promise<void>
  pause: (options: HumanPauseOptions) => Promise<void>
}

export const motionCurves = {
  linear: (progress: number) => progress,
  easeInCubic: (progress: number) => progress ** 3,
  easeOutCubic: (progress: number) => 1 - (1 - progress) ** 3,
  easeInOutCubic: (progress: number) => progress < 0.5
    ? 4 * progress ** 3
    : 1 - (-2 * progress + 2) ** 3 / 2,
} satisfies Record<string, HumanMotionCurveFunction>

export const scrollCurves = motionCurves

const NAMED_MOTION_CURVES: Record<HumanMotionCurveName, HumanMotionCurveFunction> = {
  'linear': motionCurves.linear,
  'ease-in': motionCurves.easeInCubic,
  'ease-out': motionCurves.easeOutCubic,
  'ease-in-out': motionCurves.easeInOutCubic,
}

function wait(duration: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, Math.max(0, Math.round(duration))))
}

function assertFinite(value: number, label: string): void {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${label} must be a finite number`)
  }
}

function assertDuration(duration: number, label: string): void {
  if (!Number.isFinite(duration) || duration < 0) {
    throw new RangeError(`${label} must be a non-negative finite number`)
  }
}

function assertPoint(point: HumanPoint, label: string): void {
  assertFinite(point.x, `${label}.x`)
  assertFinite(point.y, `${label}.y`)
}

function resolveMotionCurve(input: HumanMotionCurve): HumanMotionCurveFunction {
  const curve = typeof input === 'function' ? input : NAMED_MOTION_CURVES[input]
  if (!curve) {
    throw new RangeError('unknown motion curve; expected linear, ease-in, ease-out, or ease-in-out')
  }

  const start = curve(0)
  const end = curve(1)
  if (!Number.isFinite(start) || !Number.isFinite(end) || Math.abs(start) > 1e-9 || Math.abs(end - 1) > 1e-9) {
    throw new RangeError('motion curve must satisfy curve(0) = 0 and curve(1) = 1')
  }
  return curve
}

function curveValue(curve: HumanMotionCurveFunction, progress: number): number {
  const value = curve(progress)
  if (!Number.isFinite(value)) {
    throw new RangeError(`motion curve returned a non-finite value at progress ${progress}`)
  }
  return value
}

async function runTimeline(duration: number, callback: (progress: number, isLast: boolean) => Promise<void>): Promise<void> {
  assertDuration(duration, 'motion duration')
  const frameCount = Math.max(1, Math.round(duration / (1000 / 60)))
  const startedAt = performance.now()

  for (let frame = 1; frame <= frameCount; frame += 1) {
    const progress = frame / frameCount
    await wait(startedAt + duration * progress - performance.now())
    await callback(progress, frame === frameCount)
  }
}

function segmentText(text: string): string[] {
  const Segmenter = Intl.Segmenter
  if (Segmenter) {
    return Array.from(new Segmenter(undefined, { granularity: 'grapheme' }).segment(text), item => item.segment)
  }
  return Array.from(text)
}

function isKeyboardCharacter(value: string): boolean {
  return /^[\x20-\x7E]$/.test(value)
}

async function typeCharacter(page: HumanPage, value: string): Promise<void> {
  if (isKeyboardCharacter(value)) {
    await page.keyboard.type(value)
    return
  }
  await page.keyboard.insertText(value)
}

function isHumanTarget(target: HumanTarget | HumanPoint): target is HumanTarget {
  return typeof (target as HumanTarget).boundingBox === 'function'
}

async function resolveTargetPoint(options: HumanMoveOptions): Promise<HumanPoint> {
  if (!isHumanTarget(options.target)) {
    if (options.position) {
      throw new TypeError('move position is only valid for Locator targets')
    }
    assertPoint(options.target, 'move target')
    return { ...options.target }
  }

  if (options.ensureVisible) {
    await options.target.scrollIntoViewIfNeeded()
  }
  const box = await options.target.boundingBox()
  if (!box) {
    throw new Error('Human target is not visible')
  }

  const position = options.position ?? { x: box.width / 2, y: box.height / 2 }
  assertPoint(position, 'move position')
  return { x: box.x + position.x, y: box.y + position.y }
}

function linearPoint(start: HumanPoint, end: HumanPoint, progress: number): HumanPoint {
  return {
    x: start.x + (end.x - start.x) * progress,
    y: start.y + (end.y - start.y) * progress,
  }
}

function cubicBezier(start: HumanPoint, controlA: HumanPoint, controlB: HumanPoint, end: HumanPoint, progress: number): HumanPoint {
  const inverse = 1 - progress
  return {
    x: inverse ** 3 * start.x + 3 * inverse ** 2 * progress * controlA.x + 3 * inverse * progress ** 2 * controlB.x + progress ** 3 * end.x,
    y: inverse ** 3 * start.y + 3 * inverse ** 2 * progress * controlA.y + 3 * inverse * progress ** 2 * controlB.y + progress ** 3 * end.y,
  }
}

function resolvePointerPath(path: HumanPointerPath, start: HumanPoint, end: HumanPoint): HumanPointerPathFunction {
  if (typeof path === 'function') {
    return path
  }
  if (path === 'linear') {
    return (progress, pathStart, pathEnd) => linearPoint(pathStart, pathEnd, progress)
  }

  assertFinite(path.curvature, 'bezier curvature')
  const deltaX = end.x - start.x
  const deltaY = end.y - start.y
  const distance = Math.hypot(deltaX, deltaY)
  const normalX = distance === 0 ? 0 : -deltaY / distance
  const normalY = distance === 0 ? 0 : deltaX / distance
  const controlA = {
    x: start.x + deltaX / 3 + normalX * path.curvature,
    y: start.y + deltaY / 3 + normalY * path.curvature,
  }
  const controlB = {
    x: start.x + deltaX * 2 / 3 + normalX * path.curvature,
    y: start.y + deltaY * 2 / 3 + normalY * path.curvature,
  }
  return progress => cubicBezier(start, controlA, controlB, end, progress)
}

function validateTypingCurve(curve: HumanMotionCurveFunction): void {
  let previous = curveValue(curve, 0)
  for (let sample = 1; sample <= 100; sample += 1) {
    const current = curveValue(curve, sample / 100)
    if (current < previous - 1e-9 || current < -1e-9 || current > 1 + 1e-9) {
      throw new RangeError('typing curve must be monotonic and stay between 0 and 1')
    }
    previous = current
  }
}

function inverseCurve(curve: HumanMotionCurveFunction, target: number): number {
  let lower = 0
  let upper = 1
  for (let iteration = 0; iteration < 40; iteration += 1) {
    const middle = (lower + upper) / 2
    if (curveValue(curve, middle) < target) {
      lower = middle
    }
    else {
      upper = middle
    }
  }
  return (lower + upper) / 2
}

interface HumanScrollGesture {
  distance: number
  duration: number
  pauseAfter: number
}

const SCROLL_LIGHT_RANGE: HumanRange = [500, 800]
const SCROLL_REGULAR_RANGE: HumanRange = [850, 1200]
const SCROLL_HEAVY_RANGE: HumanRange = [1200, 1600]
const SCROLL_MIN_FINAL_GESTURE = 350
const SCROLL_GESTURE_DURATION_RANGE: HumanRange = [180, 380]
const SCROLL_PAUSE_RANGE: HumanRange = [120, 360]
const SCROLL_LONG_PAUSE_RANGE: HumanRange = [450, 900]
const SCROLL_MIN_GESTURE_DURATION = 120
const SCROLL_MIN_PAUSE = 80

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min)
}

function randomScrollGestureDistance(): number {
  const roll = Math.random()
  if (roll < 0.2) {
    return randomBetween(...SCROLL_LIGHT_RANGE)
  }
  if (roll < 0.85) {
    return randomBetween(...SCROLL_REGULAR_RANGE)
  }
  return randomBetween(...SCROLL_HEAVY_RANGE)
}

function buildScrollGestureDistances(distance: number): number[] {
  const direction = Math.sign(distance)
  let remaining = Math.abs(distance)
  const gestures: number[] = []

  while (remaining > 0) {
    if (remaining <= SCROLL_HEAVY_RANGE[1]) {
      if (gestures.length > 0 && remaining < SCROLL_MIN_FINAL_GESTURE) {
        gestures[gestures.length - 1] += remaining
      }
      else {
        gestures.push(remaining)
      }
      break
    }

    let gestureDistance = randomScrollGestureDistance()
    const leftover = remaining - gestureDistance
    if (leftover > 0 && leftover < SCROLL_LIGHT_RANGE[0]) {
      gestureDistance = remaining - SCROLL_LIGHT_RANGE[0]
    }
    if (gestureDistance < SCROLL_MIN_FINAL_GESTURE) {
      gestureDistance = Math.min(remaining, SCROLL_MIN_FINAL_GESTURE)
    }

    gestures.push(gestureDistance)
    remaining -= gestureDistance
  }

  return gestures.map(value => value * direction)
}

function naturalScrollGestureDuration(distance: number): number {
  const magnitude = Math.abs(distance)
  const sizeProgress = Math.min(1, magnitude / SCROLL_HEAVY_RANGE[1])
  return randomBetween(...SCROLL_GESTURE_DURATION_RANGE) * (0.8 + sizeProgress * 0.35)
}

function naturalScrollPauseAfter(index: number, count: number): number {
  if (index === count - 1) {
    return 0
  }
  if (count >= 3 && index > 0 && Math.random() < 0.18) {
    return randomBetween(...SCROLL_LONG_PAUSE_RANGE)
  }
  return randomBetween(...SCROLL_PAUSE_RANGE)
}

function buildScrollGestures(distance: number, duration: number): HumanScrollGesture[] {
  const distances = buildScrollGestureDistances(distance)
  if (duration === 0) {
    return distances.map(gestureDistance => ({
      distance: gestureDistance,
      duration: 0,
      pauseAfter: 0,
    }))
  }

  const naturalGestures = distances.map((gestureDistance, index) => ({
    distance: gestureDistance,
    duration: naturalScrollGestureDuration(gestureDistance),
    pauseAfter: naturalScrollPauseAfter(index, distances.length),
  }))
  const naturalDuration = naturalGestures.reduce((total, gesture) => total + gesture.duration + gesture.pauseAfter, 0)
  const minimumDuration = distances.length === 1
    ? 0
    : distances.length * SCROLL_MIN_GESTURE_DURATION + (distances.length - 1) * SCROLL_MIN_PAUSE
  const targetDuration = Math.max(duration, minimumDuration)
  const scale = naturalDuration === 0 ? 1 : targetDuration / naturalDuration

  return naturalGestures.map(gesture => ({
    distance: gesture.distance,
    duration: gesture.duration * scale,
    pauseAfter: gesture.pauseAfter * scale,
  }))
}

async function performScrollGesture(page: HumanPage, options: HumanScrollOptions, curve: HumanMotionCurveFunction): Promise<void> {
  let sent = 0
  await runTimeline(options.duration, async (progress, isLast) => {
    const target = options.distance * curveValue(curve, progress)
    const delta = isLast ? options.distance - sent : target - sent
    sent += delta
    await page.mouse.wheel(options.axis === 'horizontal' ? delta : 0, options.axis === 'vertical' ? delta : 0)
  })
}

async function performScroll(page: HumanPage, options: HumanScrollOptions): Promise<void> {
  assertFinite(options.distance, 'scroll distance')
  assertDuration(options.duration, 'scroll duration')
  if (options.axis !== 'horizontal' && options.axis !== 'vertical') {
    throw new RangeError('scroll axis must be horizontal or vertical')
  }
  const curve = resolveMotionCurve(options.curve)
  if (options.distance === 0) {
    return
  }

  const gestures = buildScrollGestures(options.distance, options.duration)
  for (const gesture of gestures) {
    await performScrollGesture(page, { ...options, distance: gesture.distance, duration: gesture.duration }, curve)
    await wait(gesture.pauseAfter)
  }
}

export function createHuman(page: HumanPage, options: CreateHumanOptions = {}): Human {
  let pointer = options.initialPointer ? { ...options.initialPointer } : { x: 0, y: 0 }
  assertPoint(pointer, 'initial pointer')

  const human: Human = {
    async move(moveOptions) {
      const start = { ...pointer }
      const end = await resolveTargetPoint(moveOptions)
      const curve = resolveMotionCurve(moveOptions.motion.curve)
      const path = resolvePointerPath(moveOptions.motion.path, start, end)

      await runTimeline(moveOptions.motion.duration, async (progress, isLast) => {
        const point = isLast ? end : path(curveValue(curve, progress), start, end)
        assertPoint(point, 'pointer path result')
        await page.mouse.move(point.x, point.y)
        pointer = point
      })
    },

    async hover(hoverOptions) {
      const { dwellDuration, ...moveOptions } = hoverOptions
      await human.move(moveOptions)
      assertDuration(dwellDuration, 'hover dwell duration')
      await wait(dwellDuration)
    },

    async click(clickOptions) {
      const { button = 'left', settleDuration, holdDuration, ...moveOptions } = clickOptions
      await human.move(moveOptions)
      assertDuration(settleDuration, 'click settle duration')
      assertDuration(holdDuration, 'click hold duration')
      await wait(settleDuration)
      await page.mouse.down({ button })
      await wait(holdDuration)
      await page.mouse.up({ button })
    },

    async type(typeOptions) {
      assertDuration(typeOptions.duration, 'typing duration')
      if (typeOptions.mode !== 'replace' && typeOptions.mode !== 'append') {
        throw new RangeError('typing mode must be replace or append')
      }
      if (typeOptions.focus !== false) {
        await human.click({ target: typeOptions.target, ...typeOptions.focus })
      }
      if (typeOptions.mode === 'replace') {
        await page.keyboard.press('ControlOrMeta+A')
        await page.keyboard.press('Backspace')
      }

      const characters = segmentText(typeOptions.text)
      if (characters.length === 0) {
        return
      }
      const curve = resolveMotionCurve(typeOptions.curve)
      validateTypingCurve(curve)
      const startedAt = performance.now()

      for (let index = 0; index < characters.length; index += 1) {
        const characterProgress = (index + 1) / characters.length
        const timeProgress = inverseCurve(curve, characterProgress)
        await wait(startedAt + typeOptions.duration * timeProgress - performance.now())
        await typeCharacter(page, characters[index])
      }
    },

    async press(pressOptions) {
      assertDuration(pressOptions.holdDuration, 'key hold duration')
      if (!pressOptions.key) {
        throw new TypeError('key must be a non-empty string')
      }
      await page.keyboard.down(pressOptions.key)
      await wait(pressOptions.holdDuration)
      await page.keyboard.up(pressOptions.key)
    },

    async scroll(scrollOptions) {
      await performScroll(page, scrollOptions)
    },

    async pause(pauseOptions) {
      assertDuration(pauseOptions.duration, 'pause duration')
      await wait(pauseOptions.duration)
    },
  }

  return human
}

export interface LegacyHumanScrollOptions {
  distance: number
  direction?: 'down' | 'up'
  stepMin?: number
  stepMax?: number
  delayMin?: number
  delayMax?: number
  backstepChance?: number
  backstepRatio?: number
}

/** @deprecated Use `createHuman(page).scroll(options)` instead. */
export async function humanScroll(page: HumanPage, options: LegacyHumanScrollOptions): Promise<void> {
  const averageStep = ((options.stepMin ?? 50) + (options.stepMax ?? 150)) / 2
  const averageDelay = ((options.delayMin ?? 30) + (options.delayMax ?? 80)) / 2
  await performScroll(page, {
    distance: options.direction === 'up' ? -options.distance : options.distance,
    axis: 'vertical',
    duration: Math.ceil(options.distance / averageStep) * averageDelay,
    curve: 'ease-in-out',
  })
}

export interface LegacyHumanTypeOptions {
  minDelay?: number
  maxDelay?: number
}

/** @deprecated Use `createHuman(page).type(options)` instead. */
export async function humanType(page: HumanPage, text: string, options: LegacyHumanTypeOptions = {}): Promise<void> {
  const minDelay = options.minDelay ?? 60
  const maxDelay = options.maxDelay ?? 180
  for (const character of segmentText(text)) {
    await typeCharacter(page, character)
    await wait(minDelay + Math.random() * (maxDelay - minDelay))
  }
}
