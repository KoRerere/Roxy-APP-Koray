import { $t } from "/@/locales";

export enum PayWay {
  /** 银行卡 */
  Card = "Card",
  /** 余额 */
  Balance = "Balance",
  /** 支付宝 */
  Alipay = "Alipay",
  /** 微信 */
  Wechat = "Wechat",
  /** USDT */
  USDT = "USDT",
  /** USDC */
  USDC = "USDC",
  /** PayPal */
  PayPal = "PayPal",
}

export enum OrderType {
  /** 续费 */
  Renew = "renew",
  /** 订阅 */
  Subscribe = "subscribe",
  /** 变更 */
  Change = "change",
  /** 购买 */
  Purchase = "purchase",
  /** 充值 */
  Recharge = "recharge",
  /** 提现 */
  Withdraw = "withdraw",
  /** 退款 */
  Refund = "refund",
  /** 兑换 */
  Exchange = "exchange",
  /** 赠送 */
  Gift = "gift",
  /** 代理购买 */
  ProxyPurchase = "proxy_purchase",
  /** 代理退款 */
  ProxyRefund = "proxy_refund",
  /** 代理续费 */
  ProxyRenew = "proxy_renew",
  /** 官方赠送 */
  OfficialGift = "official_gift",
  /** 奖励兑换 */
  RewardRedeem = "reward_redeem",
  /** 活动奖励 */
  EventRewards = "event_rewards",
}

export const OrderTypeStr = {
  [OrderType.Renew]: $t("续费"),
  [OrderType.Subscribe]: $t("订阅"),
  [OrderType.Purchase]: $t("购买"),
  [OrderType.Change]: $t("变更"),
  [OrderType.Recharge]: $t("充值"),
  [OrderType.Withdraw]: $t("提现"),
  [OrderType.Refund]: $t("退款"),
  [OrderType.Exchange]: $t("兑换"),
  [OrderType.Gift]: $t("赠送"),
  [OrderType.ProxyPurchase]: $t("代理购买"),
  [OrderType.ProxyRefund]: $t("代理退款"),
  [OrderType.ProxyRenew]: $t("代理续费"),
  [OrderType.OfficialGift]: $t("官方赠送"),
  [OrderType.RewardRedeem]: $t("奖励兑换"),
  [OrderType.EventRewards]: $t("活动奖励"),
};

export enum SubOrderType {
  /** 普通订阅 */
  Subscribe = "subscribe",
  /** 升级套餐 */
  Upgrade = "upgrade",
  /** 自动续订 */
  Auto = "auto",
  /** 延长套餐 */
  Extend = "extend",
  /** 购买空间或成员 */
  Workspace_Member = "workspace_member",
  /** 降级 */
  Downgrade = "downgrade",
  /** 代理 */
  Proxy = "proxy",
}

export enum PaySubOrderType {
  /** 购买 */
  Purchase = "purchase",
  /** 升级 */
  Upgrade = "upgrade",
}

export enum PaymentStatus {
  /** 支付成功 */
  Success = "TRADE_SUCCESS",
  /** 交易关闭 */
  Closed = "TRADE_CLOSED",
  /** 待支付 */
  Wait = "WAIT_BUYER_PAY",
  /** 自动扣款失败 */
  Fail = "TRADE_FAIL",
}

export const PaymentStatusStr = {
  [PaymentStatus.Success]: $t("支付成功"),
  [PaymentStatus.Closed]: $t("交易关闭"),
  [PaymentStatus.Wait]: $t("待支付"),
  [PaymentStatus.Fail]: $t("支付失败")
}

export enum PayIdentity {
  /** 新用户 */
  new = "new",
  /** 特邀用户 */
  invited = "invited",
  /** 老用户 */
  old = "old",
  /** 高级合作伙伴 */
  agent = "agent",
  /** 合作伙伴 */
  partner = "partner",
  /** 尊享会员 */
  premium = "premium",
}

export enum PurchaseType {
  /** 钱包 */
  Wallet = "wallet",
  /** 工作空间 */
  Workspace = "workspace",
  /** 员工 */
  Staff = "staff",
  /** 窗口 */
  Profile = "profile",
  /** 工作空间和员工 */
  Workspace_Staff = "workspace_staff",
  /** 代理 */
  Proxy = "proxy",
}

export enum SubLevelEnum {
  Free = "Free",
  Expired = "Expired",
  Trial = "Trial",
  Basic = "Basic",
  Pro = "Pro",
  Business = "Business",
  Enterprise = "Enterprise",
}

export const SubLevelEnumStr = {
  [SubLevelEnum.Free]: $t('免费'),
  [SubLevelEnum.Expired]: $t('已过期'),
  [SubLevelEnum.Trial]: $t('免费试用'),
  [SubLevelEnum.Basic]: $t('基础版'),
  [SubLevelEnum.Pro]: $t('专业版'),
  [SubLevelEnum.Business]: $t('商业版'),
  [SubLevelEnum.Enterprise]: $t('企业版'),
};

/** 日志保留天数 */
export const LogRetentionDays = {
  [SubLevelEnum.Free]: 3,
  [SubLevelEnum.Expired]: 3,
  [SubLevelEnum.Trial]: 7,
  [SubLevelEnum.Basic]: 7,
  [SubLevelEnum.Pro]: 15,
  [SubLevelEnum.Business]: 30,
  [SubLevelEnum.Enterprise]: 60,
} as Record<SubLevelEnum, number>

export enum AutoRenewalStatus {
  /** 关闭 */
  Close = 0,
  /** 开启 */
  Open = 1,
}

export enum AutoRechargeStatus {
  /** 关闭 */
  Close = 0,
  /** 开启 */
  Open = 1,
}

export enum AutoRenewalPayStatus {
  /** 未扣款 */
  Unpaid = 0,
  /** 扣款成功 */
  Success = 1,
  /** 扣款失败 */
  Fail = 2,
}
