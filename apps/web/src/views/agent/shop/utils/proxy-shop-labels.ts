import type { ComputedRef } from 'vue'
import { useRouteContext } from '/@/composables/useRouteContext'

/** 代理 IP 商城/设备管理共用弹窗文案：普通模式用「代理 IP」，电商模式用「设备」 */
export interface ProxyShopLabels {
  entity: string
  autoRenewExpireDesc: string
  autoRenewImmediateAlert: (hour: number) => string
  helpProblemDescription: string
  helpProblemDescriptionMaintenance: string
  helpReplaceTitle: string
  helpNetworkTips: string
  resourcePageLink: string
  entityTypeColumn: string
  entityInfoColumn: string
  autoDetectProxy: string
  exportRequiresKycDesc: string
  /** 导出 KYC 拦截：成员视角说明 */
  exportRequiresKycDescMember: string
  /** 下载弹窗标题 */
  downloadSelectedTitle: string
  /** 下载弹窗：格式字段标签 */
  downloadFormatLabel: string
  /** 下载弹窗：协议说明 */
  downloadProtocolTip: string
  /** 缺货弹窗标题 */
  sellOutTitle: string
  /** 缺货弹窗说明 */
  sellOutDescription: string
  /** 缺货通知 toast 详情 */
  sellOutNotifyDetail: string
  /** 无购买权限弹窗标题 */
  noBuyPermissionTitle: string
  /** 无购买权限弹窗说明 */
  noBuyPermissionDescription: string
  /** 续费弹窗标题 */
  renewTitle: string
  /** 续费弹窗数量说明 */
  renewCountDesc: (count: number) => string
  /** 续费弹窗底部混合优惠：中文用 {discount} 折，英/俄用 {off}% off，{count} 留给人数高亮 */
  mixedLongRenewEnjoy: string
  /** 升级带宽弹窗数量说明 */
  upgradeCountDesc: (count: number) => string
  /** 并发测速顶栏：个代理 IP / 个设备 正在测试中 */
  concurrentTestingLabel: string
  /** 单条检测失败 toast */
  testFailedCheckConfig: string
}

interface ProxyShopLabelsBase {
  entity: string
  autoRenewExpireDesc: string
  helpProblemDescription: string
  helpProblemDescriptionMaintenance: string
  helpReplaceTitle: string
  helpNetworkTips: string
  resourcePageLink: string
  entityTypeColumn: string
  entityInfoColumn: string
  autoDetectProxy: string
  exportRequiresKycDesc: string
  exportRequiresKycDescMember: string
  downloadSelectedTitle: string
  downloadFormatLabel: string
  downloadProtocolTip: string
  sellOutTitle: string
  sellOutDescription: string
  sellOutNotifyDetail: string
  noBuyPermissionTitle: string
  noBuyPermissionDescription: string
}

const PROXY_SHOP_LABELS: ProxyShopLabelsBase = {
  entity: $t('代理 IP'),
  autoRenewExpireDesc: $t('开启自动续费后，系统会在代理 IP 到期时自动尝试从 {bold} 扣费。', { bold: '{bold}' }),
  helpProblemDescription: $t('我们检测到您购买的代理 IP 存在问题，以下是一些推荐的解决方案。'),
  helpProblemDescriptionMaintenance: $t('当前 IP 所属线路正在维护，暂时无法正常连接。技术团队正在加紧处理，请于维护结束后重新检测。由此给您带来的不便，我们深表歉意，感谢您的理解与支持。'),
  helpReplaceTitle: $t('更换新代理 IP'),
  helpNetworkTips: $t('出现网络波动的代理 IP 通常会在几小时内自动恢复，若您已将其投入长期使用计划，可以尝试耐心等待其自动恢复或联系我们取得确切答复。'),
  resourcePageLink: $t('代理 IP 页面'),
  entityTypeColumn: $t('代理 IP 类型'),
  entityInfoColumn: $t('代理 IP 信息'),
  autoDetectProxy: $t('自动检测代理 IP'),
  exportRequiresKycDesc: $t('根据相关法规要求，导出代理 IP 需团队创建者完成实名认证。请在此完成企业或个人认证，认证通过后即可解锁团队导出限制。'),
  exportRequiresKycDescMember: $t('根据相关法规要求，导出代理 IP 需团队创建者完成实名认证。请联系您的团队创建者尽快完成认证。'),
  downloadSelectedTitle: $t('下载选中的代理 IP 信息'),
  downloadFormatLabel: $t('代理 IP 格式:'),
  downloadProtocolTip: $t('代理 IP 支持 HTTP 和 SOCKS5 协议'),
  sellOutTitle: $t('当前代理 IP 暂时缺货'),
  sellOutDescription: $t('点击下方按钮加入到货通知名单，代理 IP 补货后我们将第一时间通知您。你也可以通过 Rola-IP 进行选购。'),
  sellOutNotifyDetail: $t('当前代理 IP 补货或上架时，我们将通过站内通知提醒您'),
  noBuyPermissionTitle: $t('暂无代理 IP 购买权限'),
  noBuyPermissionDescription: $t('当前团队暂无代理 IP 购买权限，可前往个人空间购买或联系管理员开通权限。'),
}

const DEVICE_SHOP_LABELS: ProxyShopLabelsBase = {
  entity: $t('设备'),
  autoRenewExpireDesc: $t('开启自动续费后，系统会在设备到期时自动尝试从 {bold} 扣费。', { bold: '{bold}' }),
  helpProblemDescription: $t('我们检测到您购买的设备存在问题，以下是一些推荐的解决方案。'),
  helpProblemDescriptionMaintenance: $t('当前设备所属线路正在维护，暂时无法正常连接。技术团队正在加紧处理，请于维护结束后重新检测。由此给您带来的不便，我们深表歉意，感谢您的理解与支持。'),
  helpReplaceTitle: $t('更换新设备'),
  helpNetworkTips: $t('出现网络波动的设备通常会在几小时内自动恢复，若您已将其投入长期使用计划，可以尝试耐心等待其自动恢复或联系我们取得确切答复。'),
  resourcePageLink: $t('设备管理'),
  entityTypeColumn: $t('设备类型'),
  entityInfoColumn: $t('设备信息'),
  autoDetectProxy: $t('自动检测设备'),
  exportRequiresKycDesc: $t('根据相关法规要求，导出设备需团队创建者完成实名认证。请在此完成企业或个人认证，认证通过后即可解锁团队导出限制。'),
  exportRequiresKycDescMember: $t('根据相关法规要求，导出设备需团队创建者完成实名认证。请联系您的团队创建者尽快完成认证。'),
  downloadSelectedTitle: $t('下载选中的设备信息'),
  downloadFormatLabel: $t('设备格式:'),
  downloadProtocolTip: $t('设备支持 HTTP 和 SOCKS5 协议'),
  sellOutTitle: $t('当前设备暂时缺货'),
  sellOutDescription: $t('点击下方按钮加入到货通知名单，设备补货后我们将第一时间通知您。你也可以通过 Rola-IP 进行选购。'),
  sellOutNotifyDetail: $t('当前设备补货或上架时，我们将通过站内通知提醒您'),
  noBuyPermissionTitle: $t('暂无设备购买权限'),
  noBuyPermissionDescription: $t('当前团队暂无设备购买权限，可前往个人空间购买或联系管理员开通权限。'),
}

/** 按 workspace 模式生成代理商城弹窗文案 */
export function createProxyShopLabels(isEcommerce: boolean): ProxyShopLabels {
  const base = isEcommerce ? DEVICE_SHOP_LABELS : PROXY_SHOP_LABELS
  return {
    ...base,
    renewTitle: isEcommerce ? $t('续费设备') : $t('续费代理 IP'),
    renewCountDesc: count => isEcommerce
      ? $t('本次续费设备：{count}', { count })
      : $t('本次续费代理 IP：{count}', { count }),
    mixedLongRenewEnjoy: isEcommerce
      ? $t('享受 {discount} 折长续优惠的设备：{count}', { discount: '{discount}', off: '{off}', count: '{count}' })
      : $t('享受 {discount} 折长续优惠的代理 IP：{count}', { discount: '{discount}', off: '{off}', count: '{count}' }),
    upgradeCountDesc: count => isEcommerce
      ? $t('您将要升级 {count} 个设备:', { count })
      : $t('您将要升级 {count} 个代理 IP:', { count }),
    concurrentTestingLabel: isEcommerce ? $t('个设备正在测试中') : $t('个代理 IP 正在测试中'),
    testFailedCheckConfig: isEcommerce
      ? $t('设备检测失败，请检查设备配置')
      : $t('代理 IP 检测失败，请检查代理 IP 配置'),
    autoRenewImmediateAlert: hour => isEcommerce
      ? $t('距离到期时间不足 {hour} 小时的设备，开启后将立即执行续费。\n到期前 {hour} 小时无法修改自动续费开关。', { hour })
      : $t('距离到期时间不足 {hour} 小时的代理 IP，开启后将立即执行续费。\n到期前 {hour} 小时无法修改自动续费开关。', { hour }),
  }
}

/** 组件内按当前 workspace 类型读取文案 */
export function useProxyShopLabels(): ComputedRef<ProxyShopLabels> {
  const { isEcommerce } = useRouteContext()
  return computed(() => createProxyShopLabels(isEcommerce.value))
}
