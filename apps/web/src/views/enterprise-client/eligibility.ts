/** 单笔订单金额，不含活动赠送、钱包累计余额或支付渠道防撞金额。 */
export function isEnterpriseRechargeEligible(amount: number | undefined): boolean {
  return typeof amount === 'number' && Number.isFinite(amount) && amount >= 200
}

/** 仅按本次已支付订单的 IP 数量判断，不累计历史购买或续费数量。 */
export function isEnterpriseProxyPurchaseEligible(quantity: number | undefined): boolean {
  return typeof quantity === 'number' && Number.isInteger(quantity) && quantity >= 10
}

/** 按本次订单订阅的付费窗口数量判断，不包含赠送窗口或其他历史资源。 */
export function isEnterpriseProfilePurchaseEligible(quantity: number | undefined): boolean {
  return typeof quantity === 'number' && Number.isInteger(quantity) && quantity >= 200
}
