import { $t } from '/@/locales'

export enum PayWay {
  /** 银行卡 */
  Card = 'Card',
  /** 信用卡 */
  Credit = 'Credit',
  /** 余额 */
  Balance = 'Balance',
  /** 支付宝 */
  Alipay = 'Alipay',
  /** 微信 */
  Wechat = 'Wechat',
  /** USDT */
  USDT = 'USDT',
  /** USDC */
  USDC = 'USDC',
  /** PayPal */
  PayPal = 'PayPal',
  /** Apple Pay */
  ApplePay = 'ApplePay',
  /** Google Pay */
  GooglePay = 'GooglePay',
  // 以下值为后端 user_get_pay_channel_fees 的 payType，需与接口完全一致
  /** 马来西亚 FPX 网上银行 */
  FpxMy = 'fpx_my',
  /** 菲律宾 GCash */
  GcashPh = 'gcash_ph',
  /** 印度 UPI */
  UpiIn = 'upi_in',
  /** 奥地利 EPS */
  EpsAt = 'eps_at',
  /** 波兰 Przelewy24 */
  P24Pl = 'p24_pl',
  /** 波兰 PayU */
  PayuPl = 'payu_pl',
  /** 捷克 PayU */
  PayuCz = 'payu_cz',
  /** 葡萄牙 Multibanco */
  MultibancoPt = 'multibanco_pt',
  /** 比特币 */
  Bitcoin = 'bitcoin',
  /** 马来西亚 GrabPay */
  GrabpayMy = 'grabpay_my',
  /** 波兰 BLIK */
  BlikPl = 'blik_pl',
  /** 巴西 Pix */
  PixBr = 'pix_br',
  /** 马来西亚 Touch 'n Go */
  TouchngoMy = 'touchngo_my',
  /** 马来西亚 DuitNow */
  DuitnowMy = 'duitnow_my',
  /** 俄罗斯 SBP（Система быстрых платежей） */
  SbpRu = 'sbp_ru',
  /** 俄罗斯 YooMoney */
  YoomoneyRu = 'yoomoney_ru',
  /** 俄罗斯 SberPay */
  SberpayRu = 'sberpay_ru',
  /** 泰国 PromptPay */
  PromptpayTh = 'promptpay_th',
  /** 泰国 TrueMoney */
  TruemoneyTh = 'truemoney_th',
  /** 越南 VietQR */
  VietqrVn = 'vietqr_vn',
}

/** 银行卡与信用卡共用 Stripe 表单、绑卡与订单轮询 */
export function isCardPayWay(payway?: PayWay | string | null): payway is PayWay.Card | PayWay.Credit {
  return payway === PayWay.Card || payway === PayWay.Credit
}

/** 支付方式展示文案 */
export const PayWayStr = {
  get [PayWay.Card]() {
    return $t('银行卡')
  },
  get [PayWay.Credit]() {
    return $t('信用卡')
  },
  get [PayWay.Balance]() {
    return $t('Roxy 钱包')
  },
  get [PayWay.Alipay]() {
    return $t('支付宝')
  },
  get [PayWay.Wechat]() {
    return $t('微信支付')
  },
  get [PayWay.USDT]() {
    return 'USDT'
  },
  get [PayWay.USDC]() {
    return 'USDC'
  },
  get [PayWay.PayPal]() {
    return 'PayPal'
  },
  get [PayWay.ApplePay]() {
    return 'Apple Pay'
  },
  get [PayWay.GooglePay]() {
    return 'Google Pay'
  },
  get [PayWay.FpxMy]() {
    return 'FPX'
  },
  get [PayWay.GcashPh]() {
    return 'GCash'
  },
  get [PayWay.UpiIn]() {
    return 'UPI'
  },
  get [PayWay.EpsAt]() {
    return 'EPS'
  },
  get [PayWay.P24Pl]() {
    return 'Przelewy24'
  },
  get [PayWay.PayuPl]() {
    return 'PayU PL'
  },
  get [PayWay.PayuCz]() {
    return 'PayU CZ'
  },
  get [PayWay.MultibancoPt]() {
    return 'Multibanco'
  },
  get [PayWay.Bitcoin]() {
    return 'Bitcoin'
  },
  get [PayWay.GrabpayMy]() {
    return 'GrabPay'
  },
  get [PayWay.BlikPl]() {
    return 'BLIK'
  },
  get [PayWay.PixBr]() {
    return 'Pix'
  },
  get [PayWay.TouchngoMy]() {
    return 'Touch \'n Go'
  },
  get [PayWay.DuitnowMy]() {
    return 'DuitNow'
  },
  get [PayWay.SbpRu]() {
    return 'SBP'
  },
  get [PayWay.YoomoneyRu]() {
    return 'YooMoney'
  },
  get [PayWay.SberpayRu]() {
    return 'SberPay'
  },
  get [PayWay.PromptpayTh]() {
    return 'PromptPay'
  },
  get [PayWay.TruemoneyTh]() {
    return 'TrueMoney'
  },
  get [PayWay.VietqrVn]() {
    return 'VietQR'
  },
}

export enum OrderType {
  /** 续费 */
  Renew = 'renew',
  /** 订阅 */
  Subscribe = 'subscribe',
  /** 变更 */
  Change = 'change',
  /** 购买 */
  Purchase = 'purchase',
  /** 充值 */
  Recharge = 'recharge',
  /** 提现 */
  Withdraw = 'withdraw',
  /** 退款 */
  Refund = 'refund',
  /** 兑换 */
  Exchange = 'exchange',
  /** 赠送 */
  Gift = 'gift',
  /** 代理 IP 购买 */
  ProxyPurchase = 'proxy_purchase',
  /** 代理 IP 退款 */
  ProxyRefund = 'proxy_refund',
  /** 代理 IP 续费 */
  ProxyRenew = 'proxy_renew',
  /** 官方赠送 */
  OfficialGift = 'official_gift',
  /** 奖励兑换 */
  RewardRedeem = 'reward_redeem',
  /** 活动奖励 */
  EventRewards = 'event_rewards',
  /** AI Agent 充值 */
  PointsRecharge = 'points_recharge',
  /** 升级带宽 */
  BandwidthUpgrade = 'bandwidth_upgrade',
}

export const OrderTypeStr = {
  get [OrderType.Renew]() {
    return $t('续费')
  },
  get [OrderType.Subscribe]() {
    return $t('订阅')
  },
  get [OrderType.Purchase]() {
    return $t('购买')
  },
  get [OrderType.Change]() {
    return $t('变更')
  },
  get [OrderType.Recharge]() {
    return $t('充值')
  },
  get [OrderType.Withdraw]() {
    return $t('提现')
  },
  get [OrderType.Refund]() {
    return $t('退款')
  },
  get [OrderType.Exchange]() {
    return $t('兑换')
  },
  get [OrderType.Gift]() {
    return $t('赠送')
  },
  get [OrderType.ProxyPurchase]() {
    return $t('代理 IP 购买')
  },
  get [OrderType.ProxyRefund]() {
    return $t('代理 IP 退款')
  },
  get [OrderType.ProxyRenew]() {
    return $t('代理 IP 续费')
  },
  get [OrderType.OfficialGift]() {
    return $t('官方赠送')
  },
  get [OrderType.RewardRedeem]() {
    return $t('奖励兑换')
  },
  get [OrderType.EventRewards]() {
    return $t('活动奖励')
  },
  get [OrderType.PointsRecharge]() {
    return $t('AI Agent 积分购买')
  },
  get [OrderType.BandwidthUpgrade]() {
    return $t('升级带宽')
  },
}

export enum SubOrderType {
  /** 普通订阅 */
  Subscribe = 'subscribe',
  /** 升级套餐 */
  Upgrade = 'upgrade',
  /** 自动续费 */
  Auto = 'auto',
  /** 延长套餐 */
  Extend = 'extend',
  /** 购买空间或成员 */
  Workspace_Member = 'workspace_member',
  /** 降级 */
  Downgrade = 'downgrade',
  /** 代理 */
  Proxy = 'proxy',
}

export enum PaySubOrderType {
  /** 购买 */
  Purchase = 'purchase',
  /** 升级 */
  Upgrade = 'upgrade',
}

export enum PaymentStatus {
  /** 支付成功 */
  Success = 'TRADE_SUCCESS',
  /** 交易关闭 */
  Closed = 'TRADE_CLOSED',
  /** 待支付 */
  Wait = 'WAIT_BUYER_PAY',
  /** 自动扣款失败 */
  Fail = 'TRADE_FAIL',
  /** 已退款 */
  Refund = 'TRADE_REFUND',
}

export const PaymentStatusStr = {
  get [PaymentStatus.Success]() {
    return $t('支付成功')
  },
  get [PaymentStatus.Closed]() {
    return $t('交易关闭')
  },
  get [PaymentStatus.Wait]() {
    return $t('待支付')
  },
  get [PaymentStatus.Fail]() {
    return $t('支付失败')
  },
  get [PaymentStatus.Refund]() {
    return $t('已退款')
  },
}

export enum PayIdentity {
  /** 新用户 */
  new = 'new',
  /** 特邀用户 */
  invited = 'invited',
  /** 老用户 (创始用户) */
  old = 'old',
  /** 高级合作伙伴 */
  agent = 'agent',
  /** 合作伙伴 */
  partner = 'partner',
  /** 尊享会员 */
  premium = 'premium',
}

export enum PurchaseType {
  /** 钱包 */
  Wallet = 'wallet',
  /** 团队 */
  Workspace = 'workspace',
  /** 员工 */
  Staff = 'staff',
  /** 窗口 */
  Profile = 'profile',
  /** 团队和员工 */
  Workspace_Staff = 'workspace_staff',
  /** 代理 */
  Proxy = 'proxy',
}

export enum SubLevelEnum {
  Free = 'Free',
  Expired = 'Expired',
  Trial = 'Trial',
  Basic = 'Basic',
  Pro = 'Pro',
  Business = 'Business',
  Enterprise = 'Enterprise',
}

export const SubLevelEnumStr = {
  get [SubLevelEnum.Free]() {
    return $t('免费')
  },
  get [SubLevelEnum.Expired]() {
    return $t('已过期')
  },
  get [SubLevelEnum.Trial]() {
    return $t('免费试用')
  },
  get [SubLevelEnum.Basic]() {
    return $t('基础版')
  },
  get [SubLevelEnum.Pro]() {
    return $t('专业版')
  },
  get [SubLevelEnum.Business]() {
    return $t('商业版')
  },
  get [SubLevelEnum.Enterprise]() {
    return $t('企业版')
  },
}

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

export enum RoxyGiftsType {
  /** 静态住宅代理 IP */
  ISP = 'ISP',
  /** 动态住宅代理 IP */
  Rotating = 'ROTATING_RESIDENTIA',
  /** 窗口兑换码 */
  Profile = 'PROFILE',
  /** 团队成员 */
  Staff = 'STAFF',
}

export enum FirstGiftType {
  Static = 'static',
  Dynamic = 'dynamic',
  Discount = 'discount',
}
