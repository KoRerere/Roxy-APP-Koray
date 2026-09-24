/** 复原窗口不再提醒 */
export const RESTORE_WINDOW_NOT_REMIND = 'restoreWindowNotRemind'
/** 菜单栏是否折叠，0：折叠，1：展开 */
export const MENU_COLLAPSED = 'menuCollapsed'
export { MP_DISTINCT_ID, OFFICIAL_SITE_INVITE_CODE } from './search-params-key'
/** 官网跳转 Web App 后的目标路径（sessionStorage，登录成功后用于还原路由） */
export const OFFICIAL_SITE_REDIRECT_SESSION = 'officialSiteRedirect'
/** 自定义协议落地的一次性 redirect-action，主界面挂载后再消费 */
export const PENDING_REDIRECT_ACTION = 'pendingRedirectAction'
/** 已消费的官网深链 query（token 已脱敏），刷新后不再重复打开弹窗 */
export const HANDLED_OPEN_PAGE_QUERY = 'handledOpenPageQuery'
/** 已执行过的 redirect-action，刷新后不再重复弹窗 */
export const CONSUMED_REDIRECT_ACTION = 'consumedRedirectAction'
/** 协议 auto-login 进行中，登录页不要清掉即将写入的 token */
export const PROTOCOL_AUTO_LOGIN_PENDING = 'protocolAutoLoginPending'
/** 客户端接收成功版本号 */
export const CLIENT_RECEIVE_VERSION = 'client-receive-version'
/** 安装完成版本号 */
export const INSTALL_COMPLETE_VERSION = 'install-complete-version'
/** Electron 主窗口上次退出前的应用内路由 */
export const LAST_APP_ROUTE = 'app:lastRoute'
