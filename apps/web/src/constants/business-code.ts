/** 业务状态码 */
export const BUSINESS_CODE = {
  /** 空间数量超出 */
  WORKSPACE_MAX_LIMIT: 408,
  /** 窗口最大额度 */
  WINDOW_MAX_LIMIT: 409,
  /** 成员数量超出 */
  MEMBER_MAX_LIMIT: 411,
  /** 项目数量超出 */
  PROJECT_MAX_LIMIT: 412,
  /** 窗口模板数量超出 */
  WINDOW_TEMPLATE_MAX_LIMIT: 413,
  /** 每日创建次数超出 */
  DAILY_CREATE_LIMIT: 414,
  /** 每日打开次数超出 */
  DAILY_OPEN_LIMIT: 417,
} as const
