import type { ComputedRef } from 'vue'
import { useRouteContext } from './useRouteContext'

/** 普通模式「项目」与电商模式「分组」的展示文案 */
export interface ProjectEntityLabels {
  /** 管理单元名称：项目 / 分组 */
  entity: string
  createTitle: string
  editTitle: string
  namePlaceholder: string
  nameRequired: string
  nameMinLength: string
  nameMaxLength: string
  /** 未选择时的占位：未指定项目 / 未指定分组 */
  unspecified: string
  selectAtLeastOne: string
  selectLabel: string
  selectPlaceholder: string
  /** 邀请表单字段标签：邀请至项目 / 邀请至分组 */
  inviteToLabel: string
  currentMembersList: string
  inviteAlreadyInOther: string
  /** 创建团队 tooltip：团队数据隔离说明 */
  teamIsolationDescription: string
  /** 删除团队确认：清空内容说明（i18n-t keypath） */
  deleteTeamContentsKeypath: string
}

/**
 * 按 workspace 模式生成项目/分组相关 UI 文案
 * @param isEcommerce 是否为电商 workspace
 */
export function createProjectEntityLabels(isEcommerce: boolean): ProjectEntityLabels {
  if (isEcommerce) {
    return {
      entity: $t('分组'),
      createTitle: $t('创建分组'),
      editTitle: $t('编辑分组'),
      namePlaceholder: $t('请输入分组名称'),
      nameRequired: $t('请输入您的分组名称'),
      nameMinLength: $t('分组名称必须大于 1 个字符'),
      nameMaxLength: $t('分组名称最多不超过 30 个字符'),
      unspecified: $t('未指定分组'),
      selectAtLeastOne: $t('请选择至少一个分组'),
      selectLabel: $t('选择分组'),
      selectPlaceholder: $t('请选择分组'),
      inviteToLabel: $t('邀请至分组'),
      currentMembersList: $t('当前分组成员列表'),
      inviteAlreadyInOther: $t('被邀请的用户若已在其他分组中，将不会修改身份'),
      teamIsolationDescription: $t('团队是一个独立的分组环境，通过创建或加入不同团队，您可以使用单一主账号邀请成员组建团队，并为其分配不同的权限设置。每个团队内的数据（如账号、成员、设备、分组和平台账号等）完全隔离，确保团队间的操作互不干扰。'),
      deleteTeamContentsKeypath: $t('该操作不可逆，删除后将会清空所有该团队的相关内容（账号/分组/平台账号/设备/团队成员/ API 等）{br}要确认删除，请在下方输入团队名称', { br: '{br}' }),
    }
  }

  return {
    entity: $t('项目'),
    createTitle: $t('创建项目'),
    editTitle: $t('编辑项目'),
    namePlaceholder: $t('请输入项目名称'),
    nameRequired: $t('请输入您的项目名称'),
    nameMinLength: $t('项目名称必须大于 1 个字符'),
    nameMaxLength: $t('项目名称最多不超过 30 个字符'),
    unspecified: $t('未指定项目'),
    selectAtLeastOne: $t('请选择至少一个项目'),
    selectLabel: $t('选择项目'),
    selectPlaceholder: $t('请选择项目'),
    inviteToLabel: $t('邀请至项目'),
    currentMembersList: $t('当前项目成员列表'),
    inviteAlreadyInOther: $t('被邀请的用户若已在其他项目中，将不会修改身份'),
    teamIsolationDescription: $t('团队是一个独立的分组环境，通过创建或加入不同团队，您可以使用单一主账号邀请成员组建团队，并为其分配不同的权限设置。每个团队内的数据（如窗口、成员、代理 IP、项目和账号等）完全隔离，确保团队间的操作互不干扰。'),
    deleteTeamContentsKeypath: $t('该操作不可逆，删除后将会清空所有该团队的相关内容（窗口/项目/平台账号/代理 IP/团队成员/ API 等）{br}要确认删除，请在下方输入团队名称', { br: '{br}' }),
  }
}

/** 组件内按当前路由 workspace 类型读取文案 */
export function useProjectEntityLabels(): ComputedRef<ProjectEntityLabels> {
  const { isEcommerce } = useRouteContext()
  return computed(() => createProjectEntityLabels(isEcommerce.value))
}
