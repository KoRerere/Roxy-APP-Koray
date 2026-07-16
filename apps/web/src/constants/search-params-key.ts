/** 官网跳转 Web App 时携带的语言偏好 */
export const OFFICIAL_SITE_LANG = 'official-site-lang'

/** 官网跳转 Web App 时携带的邀请码（落地后写入 localStorage） */
export const OFFICIAL_SITE_INVITE_CODE = 'official-site-invite-code'

/** Web 跨语言域名跳转时携带 mixpanel distinct_id（落地后写入 localStorage） */
export const MP_DISTINCT_ID = 'mp-distinct-id'

/** Web 跨语言域名跳转时携带 token（中英文站点域名不同时无法用 Cookie，需在落地页读出后立即从 URL 移除） */
export const LOCALE_SWITCH_HANDOFF_TOKEN_QUERY = 'locale-handoff-token'

/** 官网跳转 Web App 时的来源页面标识，用于埋点 click_enter_web_login */
export const JUMP_REFERER = 'jump-referer'

/** 官网跳转 Web App 后的目标路径，语言切换 handoff 完成后用于还原路由 */
export const OFFICIAL_SITE_REDIRECT = 'official-site-redirect'

/** 官网跳转 Web App 时的重定向动作，用于 打开某个页面，并执行某个动作 */
export const REDIRECT_ACTION = 'redirect-action'
