import { BrowserIconRenderWorker } from './BrowserIconRenderWorker'

export const browserIconRenderWorker = new BrowserIconRenderWorker()

export { fitBadgeText } from './badgeMetrics'
export type { BrowserIconPackFormat, PackBrowserIconPayload } from './pack'
export { packBrowserIcon } from './pack'
export type { WriteBrowserIconPayload } from './writeBrowserIcon'
export { CHROME_BADGE_CSS, FIREFOX_BADGE_CSS, renderBadgedPng, renderIconPng } from './render'
export type { RenderBadgedPngOptions } from './render'
