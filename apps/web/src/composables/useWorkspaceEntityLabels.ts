import { useBillingEntityLabels } from './useBillingEntityLabels'
import { useDashboardEntityLabels } from './useDashboardEntityLabels'
import { useProfileEntityLabels } from './useProfileEntityLabels'
import { useProjectEntityLabels } from './useProjectEntityLabels'
import { useReferralEntityLabels } from './useReferralEntityLabels'
import { useRouteContext } from './useRouteContext'
import { useTeamEntityLabels } from './useTeamEntityLabels'
import { useTransferEntityLabels } from './useTransferEntityLabels'
import { useTutorialEntityLabels } from './useTutorialEntityLabels'
import { useExtensionLabels } from '/@/views/extensions/utils/extension-labels'
import { useProxyShopLabels } from '/@/views/agent/shop/utils/proxy-shop-labels'

/** 按 workspace 模式统一导出各域 EntityLabels */
export function useWorkspaceEntityLabels() {
  const { isEcommerce } = useRouteContext()

  return {
    isEcommerce,
    profile: useProfileEntityLabels(),
    project: useProjectEntityLabels(),
    transfer: useTransferEntityLabels(),
    billing: useBillingEntityLabels(),
    team: useTeamEntityLabels(),
    tutorial: useTutorialEntityLabels(),
    referral: useReferralEntityLabels(),
    proxy: useProxyShopLabels(),
    extension: useExtensionLabels(),
    dashboard: useDashboardEntityLabels(),
  }
}
