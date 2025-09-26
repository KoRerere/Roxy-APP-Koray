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
  get [OrderType.Renew]() { return $t("续费") },
  get [OrderType.Subscribe]() { return $t("订阅") },
  get [OrderType.Purchase]() { return $t("购买") },
  get [OrderType.Change]() { return $t("变更") },
  get [OrderType.Recharge]() { return $t("充值") },
  get [OrderType.Withdraw]() { return $t("提现") },
  get [OrderType.Refund]() { return $t("退款") },
  get [OrderType.Exchange]() { return $t("兑换") },
  get [OrderType.Gift]() { return $t("赠送") },
  get [OrderType.ProxyPurchase]() { return $t("代理购买") },
  get [OrderType.ProxyRefund]() { return $t("代理退款") },
  get [OrderType.ProxyRenew]() { return $t("代理续费") },
  get [OrderType.OfficialGift]() { return $t("官方赠送") },
  get [OrderType.RewardRedeem]() { return $t("奖励兑换") },
  get [OrderType.EventRewards]() { return $t("活动奖励") },
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
  get [PaymentStatus.Success]() {
    return $t("支付成功")
  },
  get [PaymentStatus.Closed]() {
    return $t("交易关闭")
  },
  get [PaymentStatus.Wait]() {
    return $t("待支付")
  },
  get [PaymentStatus.Fail]() {
    return $t("支付失败")
  },
}

export enum PayIdentity {
  /** 老用户 */
  old = "old",
  /** 新用户 */
  new = "new",
  /** 特邀用户 */
  invited = "invited",
  /** 合作用户 */
  agent = "agent",
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

export const PayIdentityStr = {
  get [PayIdentity.old]() {
    return $t("创始用户")
  },
  get [PayIdentity.new]() {
    return $t("新用户")
  },
  get [PayIdentity.invited]() {
    return $t("特邀用户")
  },
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
  get [SubLevelEnum.Free]() {
    return $t('免费');
  },
  get [SubLevelEnum.Expired]() {
    return $t('已过期');
  },
  get [SubLevelEnum.Trial]() {
    return $t('7天试用');
  },
  get [SubLevelEnum.Basic]() {
    return $t('基础版');
  },
  get [SubLevelEnum.Pro]() {
    return $t('专业版');
  },
  get [SubLevelEnum.Business]() {
    return $t('商业版');
  },
  get [SubLevelEnum.Enterprise]() {
    return $t('企业版');
  },
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
