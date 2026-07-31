import type { ComputedRef } from 'vue'
import { useRouteContext } from './useRouteContext'

/** 新手教程域文案：普通模式与电商模式术语差异 */
export interface TutorialEntityLabels {
  /** 任务 1 标题 */
  task1Title: string
  task1Desc: string
  task1Doc: string
  /** 任务 2 标题 */
  task2Title: string
  task2Desc: string
  task2Doc: string
  /** 任务 3 团队分享 */
  task3Desc: string
  /** 右键操作 */
  taskContextMenuTitle: string
  /** 标签/项目区分 */
  taskTagProjectTitle: string
  taskTagProjectDesc: string
  /** 高级筛选 */
  taskAdvancedSearchTitle: string
  taskAdvancedSearchDesc: string
  /** 平台账号导入 */
  taskPlatformImportDesc: string
  /** 扩展中心 */
  taskExtensionTitle: string
  taskExtensionDesc: string
  taskExtensionDoc: string
  /** 窗口同步（普通模式专属，电商仍保留原文或提示不可用） */
  taskSyncTitle: string
  taskSyncDesc: string
  taskSyncDoc: string
  /** profile-select empty desc */
  profileSelectEmptyDesc: string
  /** 侧边栏创建引导 */
  createEntityGuideDesc: string
  /** 公告：代理 IP 即将过期 */
  proxyExpireAnnouncementKeypath: string
  /** 更新器：所有窗口将被关闭 */
  closeAllEntitiesOnUpdate: string
  /** 强制升级：重启关闭窗口 */
  restartCloseEntities: string
  /** 恢复已打开窗口 */
  restoreOpenedEntities: string
  /** 内核使用中请先关闭窗口 */
  kernelInUseCloseEntities: (version: string) => string
}

/** 按 workspace 模式生成教程/引导域文案 */
export function createTutorialEntityLabels(isEcommerce: boolean): TutorialEntityLabels {
  if (isEcommerce) {
    return {
      task1Title: $t('任务 1: 创建您的第一个账号'),
      task1Desc: $t('账号是 Roxy浏览器的核心功能，其各项设定与指纹决定了您在上网浏览时被平台检测到的"身份"，根据教程创建您的第一个账号，从而开启隐私之旅！'),
      task1Doc: $t('账号文档'),
      task2Title: $t('任务 2: 导入一个设备至 Roxy'),
      task2Desc: $t('设备是确保账号安全性、匿名性的重要工具，其同时决定了部分指纹参数的生成，对您的"身份"真实性至关重要，根据教程导入您的设备，从而不再因网络环境而被限制。'),
      task2Doc: $t('设备文档'),
      task3Desc: $t('Roxy浏览器支持用户自由地与好友分享账号资源，无论是 1:1 的账号转移功能，还是加入同一团队共享账号，在这里都能轻松实现。'),
      taskContextMenuTitle: $t('通过鼠标右键便捷操作账号'),
      taskTagProjectTitle: $t('通过标签/分组区分管理账号'),
      taskTagProjectDesc: $t('当您的账号数量较多时，可以为账号设置标签或划分不同分组，从而更加高效地进行管理。'),
      taskAdvancedSearchTitle: $t('通过高级筛选快速定位账号'),
      taskAdvancedSearchDesc: $t('希望快速通过条件定位相应账号？试试"高级筛选"功能，其亦可被保存为常驻"分组"！'),
      taskPlatformImportDesc: $t('账号资源过多而难以管理？根据教程快速将其导入 Roxy浏览器，并更方便地与账号进行绑定。'),
      taskExtensionTitle: $t('通过插件中心管理插件应用'),
      taskExtensionDesc: $t('浏览器插件是高级用户不可或缺的助力工具，您可以添加/上传任何适用于常规 Chrome 的插件程序到 Roxy浏览器。'),
      taskExtensionDoc: $t('插件文档'),
      taskSyncTitle: $t('通过窗口同步简化重复操作'),
      taskSyncDesc: $t('窗口同步功能允许您同时控制多个环境，无论是多任务处理还是批量操作，都能轻松应对。'),
      taskSyncDoc: $t('窗口同步文档'),
      profileSelectEmptyDesc: $t('账号是 Roxy浏览器的核心功能，可以帮助您管理多个浏览器账号，并为它们设置不同的分组、平台账号、设备等，以方便您更好地执行业务操作。'),
      createEntityGuideDesc: $t('点击创建一个新的浏览器账号。'),
      proxyExpireAnnouncementKeypath: $t('您的一些设备即将过期。为避免您使用受到任何干扰，请{link}。', { link: '{link}' }),
      closeAllEntitiesOnUpdate: $t('所有账号将被关闭，您的工作将被保存。'),
      restartCloseEntities: $t('请注意，重启客户端会关闭你当前打开的账号。'),
      restoreOpenedEntities: $t('更新需要重启应用，重启后将为您恢复已打开的账号。'),
      kernelInUseCloseEntities: version => $t('{version} 版本正在使用中，请先关闭账号。', { version }),
    }
  }

  return {
    task1Title: $t('任务 1: 创建您的第一个窗口'),
    task1Desc: $t('窗口是 Roxy浏览器的核心功能，其各项设定与指纹决定了您在上网浏览时被平台检测到的"身份"，根据教程创建您的第一个窗口，从而开启隐私之旅！'),
    task1Doc: $t('窗口文档'),
    task2Title: $t('任务 2: 导入一个代理 IP 至 Roxy'),
    task2Desc: $t('代理 IP 是确保窗口安全性、匿名性的重要工具，其同时决定了部分指纹参数的生成，对您的"身份"真实性至关重要，根据教程导入您的代理 IP，从而不再因网络环境而被限制。'),
    task2Doc: $t('代理 IP 文档'),
    task3Desc: $t('Roxy浏览器支持用户自由地与好友分享窗口资源，无论是 1:1 的窗口转移功能，还是加入同一团队共享窗口，在这里都能轻松实现。'),
    taskContextMenuTitle: $t('通过鼠标右键便捷操作窗口'),
    taskTagProjectTitle: $t('通过标签/项目区分管理窗口'),
    taskTagProjectDesc: $t('当您的窗口数量较多时，可以为窗口设置标签或划分不同项目，从而更加高效地进行管理。'),
    taskAdvancedSearchTitle: $t('通过高级筛选快速定位窗口'),
    taskAdvancedSearchDesc: $t('希望快速通过条件定位相应窗口？试试"高级筛选"功能，其亦可被保存为常驻"分组"！'),
    taskPlatformImportDesc: $t('账号资源过多而难以管理？根据教程快速将其导入 Roxy浏览器，并更方便地与窗口进行绑定。'),
    taskExtensionTitle: $t('通过扩展中心管理扩展应用'),
    taskExtensionDesc: $t('浏览器扩展是高级用户不可或缺的助力工具，您可以添加/上传任何适用于常规 Chrome 的扩展程序到 Roxy浏览器。'),
    taskExtensionDoc: $t('扩展文档'),
    taskSyncTitle: $t('通过窗口同步简化重复操作'),
    taskSyncDesc: $t('窗口同步功能允许您同时控制多个环境，无论是多任务处理还是批量操作，都能轻松应对。'),
    taskSyncDoc: $t('窗口同步文档'),
    profileSelectEmptyDesc: $t('窗口是 Roxy浏览器的核心功能，可以帮助您管理多个浏览器窗口，并为它们设置不同的项目、平台账号、代理 IP 等，以方便您更好地执行业务操作。'),
    createEntityGuideDesc: $t('点击创建一个新的浏览器窗口。'),
    proxyExpireAnnouncementKeypath: $t('您的一些代理 IP 即将过期。为避免您使用受到任何干扰，请{link}。', { link: '{link}' }),
    closeAllEntitiesOnUpdate: $t('所有窗口将被关闭，您的工作将被保存。'),
    restartCloseEntities: $t('请注意，重启客户端会关闭你当前打开的窗口。'),
    restoreOpenedEntities: $t('更新需要重启应用，重启后将为您恢复已打开的窗口。'),
    kernelInUseCloseEntities: version => $t('{version} 版本正在使用中，请先关闭窗口。', { version }),
  }
}

/** 组件内按当前 workspace 类型读取教程/引导域文案 */
export function useTutorialEntityLabels(): ComputedRef<TutorialEntityLabels> {
  const { isEcommerce } = useRouteContext()
  return computed(() => createTutorialEntityLabels(isEcommerce.value))
}
