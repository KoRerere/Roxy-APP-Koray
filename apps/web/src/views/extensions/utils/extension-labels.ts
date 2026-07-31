import { computed, inject, provide, toValue } from 'vue'
import type { ComputedRef, InjectionKey, MaybeRefOrGetter } from 'vue'
import { useRouteContext } from '/@/composables/useRouteContext'

export type ExtensionLabelMode = 'extension' | 'plugin'

/** 扩展/插件页面文案：普通模式用「扩展」，电商模式用「插件」 */
export interface ExtensionLabels {
  mode: ExtensionLabelMode
  installedTab: string
  recommendTab: string
  infoColumn: string
  ownershipColumn: string
  noUpdateNeeded: string
  addGoogle: string
  googleStoreUrlPlaceholder: string
  deleteHeader: string
  deleteMessage: string
  securityCheck: string
  emptyTitle: string
  emptyDesc: string
  searchButton: string
  searchPlaceholder: string
  notFoundMessageKeypath: string
  installToWindow: string
  changeInList: string
  securityAlertTitle: string
  openFolderStep: string
  itemFolder: string
  itemLoading: string
  uploadFormat: string
  googleOnly: string
  nameLabel: string
  descLabel: string
  guideNoteKeypath: string
  /** 列表列：已安装项目 / 已安装分组 */
  installedProjectsColumn: string
  /** 操作项：安装到项目 / 安装到分组 */
  installToProject: string
  /** 弹窗标题：安装到项目: / 安装到分组: */
  installToProjectTitle: string
  /** Google 协议链接文案 */
  googleProtocolLink: string
  /** 表格列：项目名称 / 分组名称 */
  projectNameColumn: string
  /** 校验提示：请选择至少一个项目 / 分组 */
  selectAtLeastOneProject: string
  /** 团队安装开关：为所选项目的所有成员安装 / 为所选分组的所有成员安装 */
  installForAllMembers: string
  formatDailyLimit: (count: number) => string
  formatCheckUpdateWithCount: (count: number) => string
  /** 如何获取扩展/插件 accordion 标题 */
  howToGetTitle: string
  howToGetDesc1: string
  howToGetDesc2: string
  howToGetPracticeNote: string
}

interface ExtensionLabelsBase {
  installedTab: string
  recommendTab: string
  infoColumn: string
  ownershipColumn: string
  noUpdateNeeded: string
  addGoogle: string
  googleStoreUrlPlaceholder: string
  deleteHeader: string
  deleteMessage: string
  securityCheck: string
  emptyTitle: string
  emptyDesc: string
  searchButton: string
  searchPlaceholder: string
  notFoundMessageKeypath: string
  installToWindow: string
  changeInList: string
  securityAlertTitle: string
  openFolderStep: string
  itemFolder: string
  itemLoading: string
  uploadFormat: string
  googleOnly: string
  nameLabel: string
  descLabel: string
  guideNoteKeypath: string
  /** Google 协议链接文案 */
  googleProtocolLink: string
  installedProjectsColumn: string
  installToProject: string
  installToProjectTitle: string
  projectNameColumn: string
  selectAtLeastOneProject: string
  installForAllMembers: string
  howToGetTitle: string
  howToGetDesc1: string
  howToGetDesc2: string
  howToGetPracticeNote: string
}

const EXTENSION_LABELS: ExtensionLabelsBase = {
  installedTab: $t('已安装扩展'),
  recommendTab: $t('扩展推荐'),
  infoColumn: $t('扩展信息'),
  ownershipColumn: $t('扩展归属'),
  noUpdateNeeded: $t('暂无需要更新的扩展'),
  addGoogle: $t('添加 Google 扩展'),
  googleStoreUrlPlaceholder: $t('请输入 Google Store 中扩展的 URL'),
  deleteHeader: $t('删除扩展'),
  deleteMessage: $t('您确认要删除所选扩展吗？删除后，所有已关联项目中的窗口扩展将被移除。'),
  securityCheck: $t('扩展安全性检查'),
  emptyTitle: $t('暂无扩展'),
  emptyDesc: $t('在此添加扩展以管理，并更方便地与窗口或项目进行绑定。'),
  searchButton: $t('搜索扩展'),
  searchPlaceholder: $t('搜索您的常用扩展'),
  notFoundMessageKeypath: $t('暂未找到相关扩展，请前往 {link} 查看更多扩展', { link: '{link}' }),
  installToWindow: $t('扩展将被安装至所选项目中的 Chrome 内核窗口'),
  changeInList: $t('您可以在扩展列表中更改此选项'),
  securityAlertTitle: $t('Roxy浏览器鼓励您自行通过权威机构检查扩展的安全性，以此来减少因使用恶意扩展而导致业务资产损失的担忧。\n\n您可以根据以下推荐步骤进行扩展安全性检查。'),
  openFolderStep: $t('1. 点击下方按钮打开该扩展所在的本地文件夹'),
  itemFolder: $t('扩展文件夹'),
  itemLoading: $t('扩展加载中...'),
  uploadFormat: $t('支持Zip, CRX 格式的扩展，最大不超过 50MB'),
  googleOnly: $t('当前仅支持 Google 扩展，暂不支持 Firefox 扩展。'),
  nameLabel: $t('扩展名称'),
  descLabel: $t('扩展描述'),
  guideNoteKeypath: $t('请注意您的扩展需要满足{guide}以确保能正常运行', { guide: '{guide}' }),
  googleProtocolLink: $t('Google 扩展协议'),
  installedProjectsColumn: $t('已安装项目'),
  installToProject: $t('安装到项目'),
  installToProjectTitle: $t('安装到项目:'),
  projectNameColumn: $t('项目名称'),
  selectAtLeastOneProject: $t('请选择至少一个项目'),
  installForAllMembers: $t('为所选项目的所有成员安装'),
  howToGetTitle: $t('Roxy浏览器如何获取扩展？'),
  howToGetDesc1: $t('Roxy浏览器通过遵循 Google Chrome 官方制定的扩展程序分发与更新规范来获取.crx 安装文件。'),
  howToGetDesc2: $t('根据 Chrome 扩展的 Manifest 文件格式官方文档(1)，所有发布在 Chrome 应用商店的扩展程序，其更新服务均由 Google 官方的更新服务器(后台地址为 https://clients2.google.com/service/update2/crx)统一管理。Roxy浏览器通过向此官方服务发送一个标准化的更新检查请求(包含目标扩展程序的唯一ID)，模拟浏览器获取最新、最安全官方扩展包的过程。此操作符合 Chrome 扩展分发指南(2)中的更新机制。'),
  howToGetPracticeNote: $t('注意事项：部分不符合 Chrome 最新实践的扩展即便可以通过此方式获取，也可能无法在较高的内核版本中启用，与官方规则保持一致。'),
}

const PLUGIN_LABELS: ExtensionLabelsBase = {
  installedTab: $t('已安装插件'),
  recommendTab: $t('插件推荐'),
  infoColumn: $t('插件信息'),
  ownershipColumn: $t('插件归属'),
  noUpdateNeeded: $t('暂无需要更新的插件'),
  addGoogle: $t('添加 Google 插件'),
  googleStoreUrlPlaceholder: $t('请输入 Google Store 中插件的 URL'),
  deleteHeader: $t('删除插件'),
  deleteMessage: $t('您确认要删除所选插件吗？删除后，所有已关联分组中的账号插件将被移除。'),
  securityCheck: $t('插件安全性检查'),
  emptyTitle: $t('暂无插件'),
  emptyDesc: $t('在此添加插件以管理，并更方便地与账号或分组进行绑定。'),
  searchButton: $t('搜索插件'),
  searchPlaceholder: $t('搜索您的常用插件'),
  notFoundMessageKeypath: $t('暂未找到相关插件，请前往 {link} 查看更多插件', { link: '{link}' }),
  installToWindow: $t('插件将被安装至所选分组中的 Chrome 内核账号'),
  changeInList: $t('您可以在插件列表中更改此选项'),
  securityAlertTitle: $t('Roxy浏览器鼓励您自行通过权威机构检查插件的安全性，以此来减少因使用恶意插件而导致业务资产损失的担忧。\n\n您可以根据以下推荐步骤进行插件安全性检查。'),
  openFolderStep: $t('1. 点击下方按钮打开该插件所在的本地文件夹'),
  itemFolder: $t('插件文件夹'),
  itemLoading: $t('插件加载中...'),
  uploadFormat: $t('支持Zip, CRX 格式的插件，最大不超过 50MB'),
  googleOnly: $t('当前仅支持 Google 插件，暂不支持 Firefox 插件。'),
  nameLabel: $t('插件名称'),
  descLabel: $t('插件描述'),
  guideNoteKeypath: $t('请注意您的插件需要满足{guide}以确保能正常运行', { guide: '{guide}' }),
  googleProtocolLink: $t('Google 插件协议'),
  installedProjectsColumn: $t('已安装分组'),
  installToProject: $t('安装到分组'),
  installToProjectTitle: $t('安装到分组:'),
  projectNameColumn: $t('分组名称'),
  selectAtLeastOneProject: $t('请选择至少一个分组'),
  installForAllMembers: $t('为所选分组的所有成员安装'),
  howToGetTitle: $t('Roxy浏览器如何获取插件？'),
  howToGetDesc1: $t('Roxy浏览器通过遵循 Google Chrome 官方制定的插件分发与更新规范来获取.crx 安装文件。'),
  howToGetDesc2: $t('根据 Chrome 插件的 Manifest 文件格式官方文档(1)，所有发布在 Chrome 应用商店的插件，其更新服务均由 Google 官方的更新服务器(后台地址为 https://clients2.google.com/service/update2/crx)统一管理。Roxy浏览器通过向此官方服务发送一个标准化的更新检查请求(包含目标插件的唯一ID)，模拟浏览器获取最新、最安全官方插件包的过程。此操作符合 Chrome 插件分发指南(2)中的更新机制。'),
  howToGetPracticeNote: $t('注意事项：部分不符合 Chrome 最新实践的插件即便可以通过此方式获取，也可能无法在较高的内核版本中启用，与官方规则保持一致。'),
}

/** 按术语模式生成页面文案 */
export function createExtensionLabels(mode: ExtensionLabelMode): ExtensionLabels {
  const isPlugin = mode === 'plugin'
  return {
    mode,
    ...(isPlugin ? PLUGIN_LABELS : EXTENSION_LABELS),
    formatDailyLimit: count => isPlugin
      ? $t('每日总插件添加数量限制为 {count} 个。', { count })
      : $t('每日总扩展添加数量限制为 {count} 个。', { count }),
    formatCheckUpdateWithCount: count => isPlugin
      ? $t('检查更新完成，{count}个插件有更新', { count })
      : $t('检查更新完成，{count}个扩展有更新', { count }),
  }
}

const EXTENSION_LABELS_KEY: InjectionKey<ComputedRef<ExtensionLabels>> = Symbol('extensionLabels')

/** 页面入口：传入 mode 并完成 provide */
export function useExtensionLabels(mode: MaybeRefOrGetter<ExtensionLabelMode>): ComputedRef<ExtensionLabels>
/** 子组件：读取上层 provide 的文案，缺省回退 extension 模式 */
export function useExtensionLabels(): ComputedRef<ExtensionLabels>
export function useExtensionLabels(mode?: MaybeRefOrGetter<ExtensionLabelMode>) {
  if (mode !== undefined) {
    const labels = computed(() => createExtensionLabels(toValue(mode)))
    provide(EXTENSION_LABELS_KEY, labels)
    return labels
  }

  const { isEcommerce } = useRouteContext()
  return inject(
    EXTENSION_LABELS_KEY,
    () => computed(() => createExtensionLabels(isEcommerce.value ? 'plugin' : 'extension')),
    true,
  )
}
