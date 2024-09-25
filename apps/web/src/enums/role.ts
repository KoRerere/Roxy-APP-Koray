export enum Role {
  /** 查看者 */
  VIEWER = 0,
  /** 编辑者 */
  EDITOR = 1,
  /** 管理者 */
  MANAGER = 2,
  /** 拥有者 */
  OWNER = 3,
}

export const roleLabelMap = {
  [Role.VIEWER]: '查看者',
  [Role.EDITOR]: '编辑者',
  [Role.MANAGER]: '管理者',
  [Role.OWNER]: '拥有者',
} as const

export enum Membership {
  notJoined = 0,
  joinIn = 1,
}
