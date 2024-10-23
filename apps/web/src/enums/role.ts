import { $t } from '/@/locales'

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

export function getRoleLabelMap() {
  return ({
    [Role.VIEWER]: $t('查看者'),
    [Role.EDITOR]: $t('编辑者'),
    [Role.MANAGER]: $t('管理者'),
    [Role.OWNER]: $t('所有者'),
  }) as const
}

export enum Membership {
  notJoined = 0,
  joinIn = 1,
}
