import type { ComputedRef } from 'vue'
import { useRouteContext } from './useRouteContext'

/** 团队域文案：普通模式与电商模式术语差异 */
export interface TeamEntityLabels {
  /** 操作日志模块筛选项 */
  moduleProfiles: string
  moduleProxies: string
  moduleProjects: string
  moduleExtensions: string
  /** 已关联项目 / 已关联分组 */
  relatedProjectsColumn: string
  /** 邀请团队成员 empty desc */
  emptyDesc: string
  /** 角色说明：可以管理所有窗口... */
  roleManagerDesc: string
  roleEditorDesc: string
  roleViewerDesc: string
  /** 费用中心权限 tooltip */
  costCenterPermissionTooltip: string
}

/** 按 workspace 模式生成团队域文案 */
export function createTeamEntityLabels(isEcommerce: boolean): TeamEntityLabels {
  if (isEcommerce) {
    return {
      moduleProfiles: $t('账号'),
      moduleProxies: $t('设备'),
      moduleProjects: $t('分组'),
      moduleExtensions: $t('插件'),
      relatedProjectsColumn: $t('已关联分组'),
      emptyDesc: $t('邀请团队成员加入团队以管理，并高效地分配账号或分组的权限。'),
      roleManagerDesc: $t('可以管理所有账号，编辑所有查看者和编辑者权限'),
      roleEditorDesc: $t('可以管理所有账号，编辑所有查看者权限'),
      roleViewerDesc: $t('只能打开或查看权限内的账号信息'),
      costCenterPermissionTooltip: $t('开启后，用户将完全接管团队拥有者的资产权限，包含钱包、续订、银行卡、账号、团队、成员、设备等资产的详情查看、信息修改和购买权限，消费将会从团队所有者钱包内扣款。'),
    }
  }

  return {
    moduleProfiles: $t('窗口'),
    moduleProxies: $t('代理 IP'),
    moduleProjects: $t('项目'),
    moduleExtensions: $t('扩展'),
    relatedProjectsColumn: $t('已关联项目'),
    emptyDesc: $t('邀请团队成员加入团队以管理，并高效地分配窗口或项目的权限。'),
    roleManagerDesc: $t('可以管理所有窗口，编辑所有查看者和编辑者权限'),
    roleEditorDesc: $t('可以管理所有窗口，编辑所有查看者权限'),
    roleViewerDesc: $t('只能打开或查看权限内的窗口信息'),
    costCenterPermissionTooltip: $t('开启后，用户将完全接管团队拥有者的资产权限，包含钱包、续订、银行卡、窗口、团队、成员、代理 IP 等资产的详情查看、信息修改和购买权限，消费将会从团队所有者钱包内扣款。'),
  }
}

/** 组件内按当前 workspace 类型读取团队域文案 */
export function useTeamEntityLabels(): ComputedRef<TeamEntityLabels> {
  const { isEcommerce } = useRouteContext()
  return computed(() => createTeamEntityLabels(isEcommerce.value))
}
