import { computed, type ComputedRef } from 'vue'
import { useRouteContext } from './useRouteContext'

/** 推广计划返利文案：普通模式与电商模式术语差异 */
export interface ReferralEntityLabels {
  profileConsumptionRebate: string
  proxyConsumptionRebate: string
  proxyRebateGuide: string
}

/** 按 workspace 模式生成推广计划文案 */
export function createReferralEntityLabels(isEcommerce: boolean): ReferralEntityLabels {
  if (isEcommerce) {
    return {
      profileConsumptionRebate: $t('账号/团队/成员消费返利'),
      proxyConsumptionRebate: $t('设备消费返利'),
      proxyRebateGuide: $t('您现在可以获得名下用户的设备消费返利了。'),
    }
  }

  return {
    profileConsumptionRebate: $t('窗口/团队/成员消费返利'),
    proxyConsumptionRebate: $t('代理 IP 消费返利'),
    proxyRebateGuide: $t('您现在可以获得名下用户的代理 IP 消费返利了。'),
  }
}

/** 组件内按当前 workspace 类型读取推广计划文案 */
export function useReferralEntityLabels(): ComputedRef<ReferralEntityLabels> {
  const { isEcommerce } = useRouteContext()
  return computed(() => createReferralEntityLabels(isEcommerce.value))
}
