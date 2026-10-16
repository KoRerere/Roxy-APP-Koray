import type { ComputedRef } from 'vue'
import { useRouteContext } from './useRouteContext'

/** 费用/套餐域文案：普通模式与电商模式术语差异 */
export interface BillingEntityLabels {
  /** 底部用量栏：窗口用量 / 账号用量 */
  entityUsage: string
  /** 无限窗口 / 无限账号 */
  unlimitedEntities: string
  /** 窗口数量 / 账号数量 */
  entityCount: string
  /** 窗口数量（免费升舱）/ 账号数量（免费升舱） */
  entityCountFreeUpgrade: string
  /** 窗口 / 账号（单价后缀等） */
  entityUnit: string
  /** 窗口单价（试用价格）/ 账号单价（试用价格） */
  entityUnitPriceTrial: string
  /** 窗口单价（{value} 数量区间）/ 账号单价（{value} 数量区间） */
  entityUnitPriceTier: (value: string) => string
  /** 滑动以选择窗口数量 / 滑动以选择账号数量 */
  selectEntityCount: string
  /** {count} 个窗口 / {count} 个账号 */
  countEntities: (count: number | string) => string
  /** {count} 窗口 / {count} 账号（账单等简写） */
  countEntitiesShort: (count: number | string) => string
  /** 窗口价格 / 账号价格 */
  entityPrice: string
  /** 窗口总价将通过各个区间的 数量×对应单价 进行累加计算 */
  entityPriceDesc: string
  /** 例: {count} 个窗口总价为 {algorithm} */
  entityPriceExample: (count: number | string, algorithm: string) => string
  /** 当前: {subLevel} ({count} 窗口)；用量: ... */
  currentPlanUsage: (params: { subLevel: string, count: number | string, useCount: number | string, maxCount: number | string }) => string
  /** 购买窗口数量少于当前窗口数 */
  purchaseLessThanCurrent: string
  /** 您选择的窗口数量少于当前套餐，确认后... */
  downgradeConfirm: string
  /** {count} 窗口, {day} 天 */
  billingPeriodEntities: (count: number | string, day: number | string) => string
  /** {oldCount} -> {newCount} 窗口 */
  upgradeEntitiesRange: (oldCount: number | string, newCount: number | string) => string
  /** 下个计费周期，套餐已更改：\n窗口数量：{count}... */
  nextBillEntities: (params: { count: number | string, amount: string, date: string }) => string
  /** 无限窗口（套餐服务卡片） */
  unlimitedEntityQuota: string
  /** 若要增加窗口上限，请{terms}{text}新套餐。 */
  upgradeForMoreEntitiesKeypath: string
  /** 窗口订阅、成员、团队：享 {profile} 折扣，代理 IP：享 {proxy} 折扣 */
  subscribeIdentityDiscount: string
  /** 永久享受窗口订阅...代理 IP... */
  subscribeIdentityDiscountPermanentKeypath: string
  /** 窗口用量不足 */
  entityUsageInsufficient: string
  /** 当前团队下的可创建窗口数量已到达上限... */
  entityUsageInsufficientTeamDetail: string
  /** 您已达到最大窗口创建限制，可通过删除不再使用的窗口或{link}。 */
  /** 项目用量不足 / 分组用量不足 */
  projectUsageInsufficient: string
  /** 当前团队下的项目数量已到达上限... */
  projectUsageInsufficientTeamDetail: string
  /** 您已达到最大项目创建限制，可通过删除不再使用的项目或{link} */
  projectMaxCreateLimitKeypath: string
  /** 代理 IP / 设备（费用中心卡片标题） */
  proxyEntity: string
  /** 代理 IP 购买 / 设备购买（账单订单类型） */
  proxyPurchaseOrderType: string
  /** 代理 IP 退款 / 设备退款（账单订单类型） */
  proxyRefundOrderType: string
  /** 代理 IP 续费 / 设备续费（账单订单类型） */
  proxyRenewOrderType: string
  /** 项目 / 分组 */
  projectEntity: string
  /** 扩展 / 插件 */
  extensionEntity: string
  /** 升级即可获取更多高级功能：窗口模板，窗口转移等等！ */
  upgradeForAdvancedFeaturesKeypath: string
  /** 窗口模板、窗口转移、窗口同步以及多项核心功能均已启用。 */
  advancedFeaturesEnabled: string
  /** 窗口订阅立享 8 折优惠（活动文案） */
  entitySubscribeDiscount: string
  /** 团队数据隔离 tooltip（expand-modal 等） */
  teamIsolationDescription: string
  /** 创建窗口模板 / 创建账号模板 */
  createEntityTemplate: string
  /** 无限项目数量 / 无限分组数量 */
  unlimitedProjects: string
  /** 窗口转移 / 账号转移 */
  entityTransfer: string
  /** 窗口同步（两种模式文案一致） */
  entitySync: string
}

/** 按 workspace 模式生成费用/套餐域文案 */
export function createBillingEntityLabels(isEcommerce: boolean): BillingEntityLabels {
  if (isEcommerce) {
    return {
      entityUsage: $t('账号用量'),
      unlimitedEntities: $t('无限账号'),
      entityCount: $t('账号数量'),
      entityCountFreeUpgrade: $t('账号数量（免费升舱）'),
      entityUnit: $t('账号'),
      entityUnitPriceTrial: $t('账号单价（试用价格）'),
      entityUnitPriceTier: value => $t('账号单价（{value} 数量区间）', { value }),
      selectEntityCount: $t('滑动以选择账号数量'),
      countEntities: count => $t('{count} 个账号', { count }),
      countEntitiesShort: count => $t('{count} 账号', { count }),
      entityPrice: $t('账号价格'),
      entityPriceDesc: $t('账号总价将通过各个区间的 数量×对应单价 进行累加计算'),
      entityPriceExample: (count, algorithm) => $t('例: {count} 个账号总价为 {algorithm}', { count, algorithm }),
      currentPlanUsage: ({ subLevel, count, useCount, maxCount }) => $t('当前: {subLevel} ({count} 账号)；用量: {useCount} / {maxCount}', { subLevel, count, useCount, maxCount }),
      purchaseLessThanCurrent: $t('购买账号数量少于当前账号数'),
      downgradeConfirm: $t('您选择的账号数量少于当前套餐，确认后，新的订阅将会在下个付费周期生效。'),
      billingPeriodEntities: (count, day) => $t('{count} 账号, {day} 天', { count, day }),
      upgradeEntitiesRange: (oldCount, newCount) => $t('{oldCount} -> {newCount} 账号', { oldCount, newCount }),
      nextBillEntities: ({ count, amount, date }) => $t('下个计费周期，套餐已更改：\n账号数量：{count}\n计费金额：{amount}\n账单日期：{date}', { count, amount, date }),
      unlimitedEntityQuota: $t('无限账号'),
      upgradeForMoreEntitiesKeypath: $t('若要增加账号上限，请{terms}{text}新套餐。', { terms: '{terms}', text: '{text}' }),
      subscribeIdentityDiscount: $t('账号订阅、成员、团队：享 {profile} 折扣，设备：享 {proxy} 折扣', { profile: '{profile}', proxy: '{proxy}' }),
      subscribeIdentityDiscountPermanentKeypath: $t('永久享受账号订阅、团队成员、团队：{profile} 折扣，设备：{proxy} 折扣{points}', { profile: '{profile}', proxy: '{proxy}', points: '{points}' }),
      entityUsageInsufficient: $t('账号用量不足'),
      entityUsageInsufficientTeamDetail: $t('当前团队下的可创建账号数量已到达上限，请删除不需要的账号或者联系团队的拥有者进行升级。'),
      projectUsageInsufficient: $t('分组用量不足'),
      projectUsageInsufficientTeamDetail: $t('当前团队下的分组数量已到达上限，请删除不再使用的分组或者联系团队的拥有者进行升级。'),
      projectMaxCreateLimitKeypath: $t('您已达到最大分组创建限制，可通过删除不再使用的分组', { link: '{link}' }),
      proxyEntity: $t('设备'),
      proxyPurchaseOrderType: $t('设备购买'),
      proxyRefundOrderType: $t('设备退款'),
      proxyRenewOrderType: $t('设备续费'),
      projectEntity: $t('分组'),
      extensionEntity: $t('插件'),
      upgradeForAdvancedFeaturesKeypath: $t('升级即可获取更多高级功能：账号模板，账号转移等等！{detail}', { detail: '{detail}' }),
      advancedFeaturesEnabled: $t('账号模板、账号转移、窗口同步以及多项核心功能均已启用。'),
      entitySubscribeDiscount: $t('账号订阅立享 8 折优惠'),
      teamIsolationDescription: $t('团队是一个独立的分组环境，通过创建或加入不同团队，您可以使用单一主账号邀请成员组建团队，并为其分配不同的权限设置。每个团队内的数据（如账号、成员、设备、分组和平台账号等）完全隔离，确保团队间的操作互不干扰。'),
      createEntityTemplate: $t('创建账号模板'),
      unlimitedProjects: $t('无限分组数量'),
      entityTransfer: $t('账号转移'),
      entitySync: $t('窗口同步'),
    }
  }

  return {
    entityUsage: $t('窗口用量'),
    unlimitedEntities: $t('无限窗口'),
    entityCount: $t('窗口数量'),
    entityCountFreeUpgrade: $t('窗口数量（免费升舱）'),
    entityUnit: $t('窗口'),
    entityUnitPriceTrial: $t('窗口单价（试用价格）'),
    entityUnitPriceTier: value => $t('窗口单价（{value} 数量区间）', { value }),
    selectEntityCount: $t('滑动以选择窗口数量'),
    countEntities: count => $t('{count} 个窗口', { count }),
    countEntitiesShort: count => $t('{count} 窗口', { count }),
    entityPrice: $t('窗口价格'),
    entityPriceDesc: $t('窗口总价将通过各个区间的 数量×对应单价 进行累加计算'),
    entityPriceExample: (count, algorithm) => $t('例: {count} 个窗口总价为 {algorithm}', { count, algorithm }),
    currentPlanUsage: ({ subLevel, count, useCount, maxCount }) => $t('当前: {subLevel} ({count} 窗口)；用量: {useCount} / {maxCount}', { subLevel, count, useCount, maxCount }),
    purchaseLessThanCurrent: $t('购买窗口数量少于当前窗口数'),
    downgradeConfirm: $t('您选择的窗口数量少于当前套餐，确认后，新的订阅将会在下个付费周期生效。'),
    billingPeriodEntities: (count, day) => $t('{count} 窗口, {day} 天', { count, day }),
    upgradeEntitiesRange: (oldCount, newCount) => $t('{oldCount} -> {newCount} 窗口', { oldCount, newCount }),
    nextBillEntities: ({ count, amount, date }) => $t('下个计费周期，套餐已更改：\n窗口数量：{count}\n计费金额：{amount}\n账单日期：{date}', { count, amount, date }),
    unlimitedEntityQuota: $t('无限窗口'),
    upgradeForMoreEntitiesKeypath: $t('若要增加窗口上限，请{terms}{text}新套餐。', { terms: '{terms}', text: '{text}' }),
    subscribeIdentityDiscount: $t('窗口订阅、成员、团队：享 {profile} 折扣，代理 IP：享 {proxy} 折扣', { profile: '{profile}', proxy: '{proxy}' }),
    subscribeIdentityDiscountPermanentKeypath: $t('永久享受窗口订阅、团队成员、团队：{profile} 折扣，代理 IP ：{proxy} 折扣{points}', { profile: '{profile}', proxy: '{proxy}', points: '{points}' }),
    entityUsageInsufficient: $t('窗口用量不足'),
    entityUsageInsufficientTeamDetail: $t('当前团队下的可创建窗口数量已到达上限，请删除不需要的窗口或者联系团队的拥有者进行升级。'),
    projectUsageInsufficient: $t('项目用量不足'),
    projectUsageInsufficientTeamDetail: $t('当前团队下的项目数量已到达上限，请删除不再使用的项目或者联系团队的拥有者进行升级。'),
    projectMaxCreateLimitKeypath: $t('您已达到最大项目创建限制，可通过删除不再使用的项目或{link}', { link: '{link}' }),
    proxyEntity: $t('代理 IP'),
    proxyPurchaseOrderType: $t('代理 IP 购买'),
    proxyRefundOrderType: $t('代理 IP 退款'),
    proxyRenewOrderType: $t('代理 IP 续费'),
    projectEntity: $t('项目'),
    extensionEntity: $t('扩展'),
    upgradeForAdvancedFeaturesKeypath: $t('升级即可获取更多高级功能：窗口模板，窗口转移等等！{detail}', { detail: '{detail}' }),
    advancedFeaturesEnabled: $t('窗口模板、窗口转移、窗口同步以及多项核心功能均已启用。'),
    entitySubscribeDiscount: $t('窗口订阅立享 8 折优惠'),
    teamIsolationDescription: $t('团队是一个独立的分组环境，通过创建或加入不同团队，您可以使用单一主账号邀请成员组建团队，并为其分配不同的权限设置。每个团队内的数据（如窗口、成员、代理 IP、项目和账号等）完全隔离，确保团队间的操作互不干扰。'),
    createEntityTemplate: $t('创建窗口模板'),
    unlimitedProjects: $t('无限项目数量'),
    entityTransfer: $t('窗口转移'),
    entitySync: $t('窗口同步'),
  }
}

/** 组件内按当前 workspace 类型读取费用/套餐域文案 */
export function useBillingEntityLabels(): ComputedRef<BillingEntityLabels> {
  const { isEcommerce } = useRouteContext()
  return computed(() => createBillingEntityLabels(isEcommerce.value))
}
