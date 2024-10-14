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
    [Role.VIEWER]: $t('Viewer'),
    [Role.EDITOR]: $t('Editor'),
    [Role.MANAGER]: $t('Manager'),
    [Role.OWNER]: $t('Owner'),
  }) as const
}

export enum Membership {
  notJoined = 0,
  joinIn = 1,
}
