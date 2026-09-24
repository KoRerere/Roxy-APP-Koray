/* eslint-disable */
/* tslint:disable */
// @ts-nocheck
/*
 * ---------------------------------------------------------------
 * ## THIS FILE WAS GENERATED VIA SWAGGER-TYPESCRIPT-API        ##
 * ##                                                           ##
 * ## AUTHOR: acacode                                           ##
 * ## SOURCE: https://github.com/acacode/swagger-typescript-api ##
 * ---------------------------------------------------------------
 */

import {
  QueryOrderStatusListData,
  QueryOrderStatusListParams,
  UserAutoRenewUpgradeListData,
  UserAutoRenewUpgradeListParams,
  UserBindCardCreateData,
  UserBindCardCreatePayload,
  UserBuyProxySettlementCreateData,
  UserBuyProxySettlementCreatePayload,
  UserCalculatePriceDifferenceListData,
  UserCalculatePriceDifferenceListParams,
  UserCalculatePriceDifferenceV2ListData,
  UserCalculatePriceDifferenceV2ListParams,
  UserCalculateWindowMonthsPriceListData,
  UserCalculateWindowMonthsPriceListParams,
  UserCancelSubscriptionListData,
  UserCancelSubscriptionListParams,
  UserCheckTeamUserRightsListData,
  UserCloudphonePlanChangeCreateData,
  UserCloudphonePlanChangeCreateError,
  UserCloudphonePlanChangeCreatePayload,
  UserCloudphonePlanRenewCreateData,
  UserCloudphonePlanRenewCreateError,
  UserCloudphonePlanRenewCreatePayload,
  UserCloudphoneQuoteCreateData,
  UserCloudphoneQuoteCreateError,
  UserCloudphoneQuoteCreatePayload,
  UserCloudphoneSettlementCreateData,
  UserCloudphoneSettlementCreateError,
  UserCloudphoneSettlementCreatePayload,
  UserDowngradeSubscriptionListData,
  UserDowngradeSubscriptionListParams,
  UserDowngradeSubscriptionV2ListData,
  UserDowngradeSubscriptionV2ListParams,
  UserGetAutoSubscriptionInfoListData,
  UserGetAutoSubscriptionInfoListParams,
  UserGetBindCardListListData,
  UserGetBindCardListListParams,
  UserGetCloudphonePlanOptionsCreateData,
  UserGetCloudphonePlanOptionsCreateError,
  UserGetCloudphonePlanOptionsCreatePayload,
  UserGetDowngradeSubscriptionInfoListData,
  UserGetDurationDiscountsByDaysListData,
  UserGetDurationDiscountsByDaysListParams,
  UserGetDurationDiscountsListData,
  UserGetPayChannelFeesListData,
  UserGetPayChannelFeesListParams,
  UserGetPayLinkListData,
  UserGetPayLinkListParams,
  UserGetPendingPaymentListListData,
  UserGetPendingPaymentListListParams,
  UserGetPurchaseRecordsInfoListData,
  UserGetPurchaseRecordsInfoListParams,
  UserGetStablecoinInfoListData,
  UserGetStripePkKeyListData,
  UserGetStripePkKeyListParams,
  UserGetSupportPayTypeListData,
  UserGetSupportPayTypeListParams,
  UserGetUserPayInfoListData,
  UserGetWindowPricingRulesListListData,
  UserGetWindowSubscriptionUpgradeMessageListData,
  UserGetWindowSubscriptionUpgradeMessageListParams,
  UserManageSubscriptionListData,
  UserManageSubscriptionListParams,
  UserMidAutumnLotteryDrawCreateData,
  UserMidAutumnLotteryPrizesListData,
  UserPayCaptchaTriggerListData,
  UserPaySettlementCreateData,
  UserPaySettlementCreatePayload,
  UserPermanentWindowSettlementCreateData,
  UserPermanentWindowSettlementCreatePayload,
  UserQueryOrderStatusListData,
  UserQueryOrderStatusListParams,
  UserQueryRedeemCodeListData,
  UserQueryRedeemCodeListParams,
  UserRechargeSettlementCreateData,
  UserRechargeSettlementCreatePayload,
  UserRedeemCodeListListData,
  UserRedeemWindowCodeCreateData,
  UserRedeemWindowCodeCreatePayload,
  UserSetAutoRechargeStatusCreateData,
  UserSetAutoRechargeStatusCreatePayload,
  UserSetAutoRenewalStatusCreateData,
  UserSetAutoRenewalStatusCreatePayload,
  UserSetMainCardCreateData,
  UserSetMainCardCreatePayload,
  UserSevenDayTrialCreateData,
  UserSevenDayTrialCreatePayload,
  UserUnbindCardCreateData,
  UserUnbindCardCreatePayload,
  UserUpdateGiftTipsListData,
  UserUpdatePayTipsListData,
  UserUpdatePayTipsListParams,
  UserWalletSettlementCreateData,
  UserWalletSettlementCreatePayload,
} from "./data-contracts";
import { ContentType, HttpClient, RequestParams } from "./http-client";

export class PayApi<SecurityDataType = unknown> {
  http: HttpClient<SecurityDataType>;

  constructor(http: HttpClient<SecurityDataType>) {
    this.http = http;
  }

  /**
   * No description
   *
   * @tags Pay
   * @name UserGetUserPayInfoList
   * @summary 获取用户付费详情
   * @request GET:/user_get_user_pay_info
   * @response `200` `UserGetUserPayInfoListData`
   */
  userGetUserPayInfoList = (params: RequestParams = {}) =>
    this.http.request<UserGetUserPayInfoListData, any>({
      path: `/user_get_user_pay_info`,
      method: "GET",
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Pay
   * @name UserGetWindowPricingRulesListList
   * @summary 获取窗口价格规则列表
   * @request GET:/user_get_window_pricing_rules_list
   * @response `200` `UserGetWindowPricingRulesListListData`
   */
  userGetWindowPricingRulesListList = (params: RequestParams = {}) =>
    this.http.request<UserGetWindowPricingRulesListListData, any>({
      path: `/user_get_window_pricing_rules_list`,
      method: "GET",
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Pay
   * @name UserGetDurationDiscountsList
   * @summary 获取用户的订阅时长折扣
   * @request GET:/user_get_duration_discounts
   * @response `200` `UserGetDurationDiscountsListData`
   */
  userGetDurationDiscountsList = (params: RequestParams = {}) =>
    this.http.request<UserGetDurationDiscountsListData, any>({
      path: `/user_get_duration_discounts`,
      method: "GET",
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Pay
   * @name UserGetPurchaseRecordsInfoList
   * @summary 获取用户购买记录详细信息
   * @request GET:/user_get_purchase_records_info
   * @response `200` `UserGetPurchaseRecordsInfoListData`
   */
  userGetPurchaseRecordsInfoList = (
    query: UserGetPurchaseRecordsInfoListParams,
    params: RequestParams = {},
  ) =>
    this.http.request<UserGetPurchaseRecordsInfoListData, any>({
      path: `/user_get_purchase_records_info`,
      method: "GET",
      query: query,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Pay
   * @name UserGetSupportPayTypeList
   * @summary 获取支付方式
   * @request GET:/user_get_support_pay_type
   * @response `200` `UserGetSupportPayTypeListData`
   */
  userGetSupportPayTypeList = (
    query: UserGetSupportPayTypeListParams,
    params: RequestParams = {},
  ) =>
    this.http.request<UserGetSupportPayTypeListData, any>({
      path: `/user_get_support_pay_type`,
      method: "GET",
      query: query,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Pay
   * @name UserQueryOrderStatusList
   * @summary 查询订单状态
   * @request GET:/user_query_order_status
   * @response `200` `UserQueryOrderStatusListData`
   */
  userQueryOrderStatusList = (
    query: UserQueryOrderStatusListParams,
    params: RequestParams = {},
  ) =>
    this.http.request<UserQueryOrderStatusListData, any>({
      path: `/user_query_order_status`,
      method: "GET",
      query: query,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Pay
   * @name UserGetPayLinkList
   * @summary 根据订单号获取支付链接
   * @request GET:/user_get_pay_link
   * @response `200` `UserGetPayLinkListData`
   */
  userGetPayLinkList = (
    query: UserGetPayLinkListParams,
    params: RequestParams = {},
  ) =>
    this.http.request<UserGetPayLinkListData, any>({
      path: `/user_get_pay_link`,
      method: "GET",
      query: query,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Pay
   * @name UserSevenDayTrialCreate
   * @summary 用户7天试用
   * @request POST:/user_seven_day_trial
   * @response `200` `UserSevenDayTrialCreateData`
   */
  userSevenDayTrialCreate = (
    data: UserSevenDayTrialCreatePayload,
    params: RequestParams = {},
  ) =>
    this.http.request<UserSevenDayTrialCreateData, any>({
      path: `/user_seven_day_trial`,
      method: "POST",
      body: data,
      type: ContentType.Json,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Pay
   * @name UserPaySettlementCreate
   * @summary 用户付费结算
   * @request POST:/user_pay_settlement
   * @response `200` `UserPaySettlementCreateData`
   */
  userPaySettlementCreate = (
    data: UserPaySettlementCreatePayload,
    params: RequestParams = {},
  ) =>
    this.http.request<UserPaySettlementCreateData, any>({
      path: `/user_pay_settlement`,
      method: "POST",
      body: data,
      type: ContentType.Json,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Pay
   * @name UserRechargeSettlementCreate
   * @summary 用户充值结算
   * @request POST:/user_recharge_settlement
   * @response `200` `UserRechargeSettlementCreateData`
   */
  userRechargeSettlementCreate = (
    data: UserRechargeSettlementCreatePayload,
    params: RequestParams = {},
  ) =>
    this.http.request<UserRechargeSettlementCreateData, any>({
      path: `/user_recharge_settlement`,
      method: "POST",
      body: data,
      type: ContentType.Json,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Pay
   * @name UserWalletSettlementCreate
   * @summary 用户钱包结算
   * @request POST:/user_wallet_settlement
   * @response `200` `UserWalletSettlementCreateData`
   */
  userWalletSettlementCreate = (
    data: UserWalletSettlementCreatePayload,
    params: RequestParams = {},
  ) =>
    this.http.request<UserWalletSettlementCreateData, any>({
      path: `/user_wallet_settlement`,
      method: "POST",
      body: data,
      type: ContentType.Json,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Pay
   * @name UserCalculatePriceDifferenceList
   * @summary 用户计算差价（旧版本用）
   * @request GET:/user_calculate_price_difference
   * @response `200` `UserCalculatePriceDifferenceListData`
   */
  userCalculatePriceDifferenceList = (
    query: UserCalculatePriceDifferenceListParams,
    params: RequestParams = {},
  ) =>
    this.http.request<UserCalculatePriceDifferenceListData, any>({
      path: `/user_calculate_price_difference`,
      method: "GET",
      query: query,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Pay
   * @name UserCalculatePriceDifferenceV2List
   * @summary 用户计算差价（新版本用）
   * @request GET:/user_calculate_price_difference_v2
   * @response `200` `UserCalculatePriceDifferenceV2ListData`
   */
  userCalculatePriceDifferenceV2List = (
    query: UserCalculatePriceDifferenceV2ListParams,
    params: RequestParams = {},
  ) =>
    this.http.request<UserCalculatePriceDifferenceV2ListData, any>({
      path: `/user_calculate_price_difference_v2`,
      method: "GET",
      query: query,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Pay
   * @name UserManageSubscriptionList
   * @summary 管理订阅
   * @request GET:/user_manage_subscription
   * @response `200` `UserManageSubscriptionListData`
   */
  userManageSubscriptionList = (
    query: UserManageSubscriptionListParams,
    params: RequestParams = {},
  ) =>
    this.http.request<UserManageSubscriptionListData, any>({
      path: `/user_manage_subscription`,
      method: "GET",
      query: query,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Pay
   * @name UserCancelSubscriptionList
   * @summary 取消订阅
   * @request GET:/user_cancel_subscription
   * @response `200` `UserCancelSubscriptionListData`
   */
  userCancelSubscriptionList = (
    query: UserCancelSubscriptionListParams,
    params: RequestParams = {},
  ) =>
    this.http.request<UserCancelSubscriptionListData, any>({
      path: `/user_cancel_subscription`,
      method: "GET",
      query: query,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Pay
   * @name UserDowngradeSubscriptionList
   * @summary 降级订阅 （旧版本用）
   * @request GET:/user_downgrade_subscription
   * @response `200` `UserDowngradeSubscriptionListData`
   */
  userDowngradeSubscriptionList = (
    query: UserDowngradeSubscriptionListParams,
    params: RequestParams = {},
  ) =>
    this.http.request<UserDowngradeSubscriptionListData, any>({
      path: `/user_downgrade_subscription`,
      method: "GET",
      query: query,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Pay
   * @name UserDowngradeSubscriptionV2List
   * @summary 降级订阅 （新版本用）
   * @request GET:/user_downgrade_subscription_v2
   * @response `200` `UserDowngradeSubscriptionV2ListData`
   */
  userDowngradeSubscriptionV2List = (
    query: UserDowngradeSubscriptionV2ListParams,
    params: RequestParams = {},
  ) =>
    this.http.request<UserDowngradeSubscriptionV2ListData, any>({
      path: `/user_downgrade_subscription_v2`,
      method: "GET",
      query: query,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Pay
   * @name UserUpdatePayTipsList
   * @summary 修改付费提示
   * @request GET:/user_update_pay_tips
   * @response `200` `UserUpdatePayTipsListData`
   */
  userUpdatePayTipsList = (
    query: UserUpdatePayTipsListParams,
    params: RequestParams = {},
  ) =>
    this.http.request<UserUpdatePayTipsListData, any>({
      path: `/user_update_pay_tips`,
      method: "GET",
      query: query,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Pay
   * @name UserCalculateWindowMonthsPriceList
   * @summary 根据数量计算窗口一个月价格
   * @request GET:/user_calculate_window_months_price
   * @response `200` `UserCalculateWindowMonthsPriceListData`
   */
  userCalculateWindowMonthsPriceList = (
    query: UserCalculateWindowMonthsPriceListParams,
    params: RequestParams = {},
  ) =>
    this.http.request<UserCalculateWindowMonthsPriceListData, any>({
      path: `/user_calculate_window_months_price`,
      method: "GET",
      query: query,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Pay
   * @name UserAutoRenewUpgradeList
   * @summary 自动续费升级套餐
   * @request GET:/user_auto_renew_upgrade
   * @response `200` `UserAutoRenewUpgradeListData`
   */
  userAutoRenewUpgradeList = (
    query: UserAutoRenewUpgradeListParams,
    params: RequestParams = {},
  ) =>
    this.http.request<UserAutoRenewUpgradeListData, any>({
      path: `/user_auto_renew_upgrade`,
      method: "GET",
      query: query,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Pay
   * @name UserGetDowngradeSubscriptionInfoList
   * @summary 查询降级订阅详细信息
   * @request GET:/user_get_downgrade_subscription_info
   * @response `200` `UserGetDowngradeSubscriptionInfoListData`
   */
  userGetDowngradeSubscriptionInfoList = (params: RequestParams = {}) =>
    this.http.request<UserGetDowngradeSubscriptionInfoListData, any>({
      path: `/user_get_downgrade_subscription_info`,
      method: "GET",
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Pay
   * @name UserUpdateGiftTipsList
   * @summary 修改Gift提示
   * @request GET:/user_update_gift_tips
   * @response `200` `UserUpdateGiftTipsListData`
   */
  userUpdateGiftTipsList = (params: RequestParams = {}) =>
    this.http.request<UserUpdateGiftTipsListData, any>({
      path: `/user_update_gift_tips`,
      method: "GET",
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Pay
   * @name UserCheckTeamUserRightsList
   * @summary 团队用户权益校验
   * @request GET:/user_check_team_user_rights
   * @response `200` `UserCheckTeamUserRightsListData`
   */
  userCheckTeamUserRightsList = (params: RequestParams = {}) =>
    this.http.request<UserCheckTeamUserRightsListData, any>({
      path: `/user_check_team_user_rights`,
      method: "GET",
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Pay
   * @name UserGetAutoSubscriptionInfoList
   * @summary 获取自动订阅详情
   * @request GET:/user_get_auto_subscription_info
   * @response `200` `UserGetAutoSubscriptionInfoListData`
   */
  userGetAutoSubscriptionInfoList = (
    query: UserGetAutoSubscriptionInfoListParams,
    params: RequestParams = {},
  ) =>
    this.http.request<UserGetAutoSubscriptionInfoListData, any>({
      path: `/user_get_auto_subscription_info`,
      method: "GET",
      query: query,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Pay
   * @name UserBuyProxySettlementCreate
   * @summary 用户购买代理结算
   * @request POST:/user_buy_proxy_settlement
   * @response `200` `UserBuyProxySettlementCreateData`
   */
  userBuyProxySettlementCreate = (
    data: UserBuyProxySettlementCreatePayload,
    params: RequestParams = {},
  ) =>
    this.http.request<UserBuyProxySettlementCreateData, any>({
      path: `/user_buy_proxy_settlement`,
      method: "POST",
      body: data,
      type: ContentType.Json,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Pay
   * @name UserSetAutoRenewalStatusCreate
   * @summary 开启/关闭窗口自动订阅
   * @request POST:/user_set_auto_renewal_status
   * @response `200` `UserSetAutoRenewalStatusCreateData`
   */
  userSetAutoRenewalStatusCreate = (
    data: UserSetAutoRenewalStatusCreatePayload,
    params: RequestParams = {},
  ) =>
    this.http.request<UserSetAutoRenewalStatusCreateData, any>({
      path: `/user_set_auto_renewal_status`,
      method: "POST",
      body: data,
      type: ContentType.Json,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Pay
   * @name UserGetPendingPaymentListList
   * @summary 获取用户自动续费列表信息
   * @request GET:/user_get_pending_payment_list
   * @response `200` `UserGetPendingPaymentListListData`
   */
  userGetPendingPaymentListList = (
    query: UserGetPendingPaymentListListParams,
    params: RequestParams = {},
  ) =>
    this.http.request<UserGetPendingPaymentListListData, any>({
      path: `/user_get_pending_payment_list`,
      method: "GET",
      query: query,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Pay
   * @name UserGetStripePkKeyList
   * @summary 获取stripe_key
   * @request GET:/user_get_stripe_pk_key
   * @response `200` `UserGetStripePkKeyListData`
   */
  userGetStripePkKeyList = (
    query: UserGetStripePkKeyListParams,
    params: RequestParams = {},
  ) =>
    this.http.request<UserGetStripePkKeyListData, any>({
      path: `/user_get_stripe_pk_key`,
      method: "GET",
      query: query,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Pay
   * @name UserBindCardCreate
   * @summary 用户绑定银行卡
   * @request POST:/user_bind_card
   * @response `200` `UserBindCardCreateData`
   */
  userBindCardCreate = (
    data: UserBindCardCreatePayload,
    params: RequestParams = {},
  ) =>
    this.http.request<UserBindCardCreateData, any>({
      path: `/user_bind_card`,
      method: "POST",
      body: data,
      type: ContentType.Json,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Pay
   * @name UserGetBindCardListList
   * @summary 获取用户绑定银行卡列表
   * @request GET:/user_get_bind_card_list
   * @response `200` `UserGetBindCardListListData`
   */
  userGetBindCardListList = (
    query: UserGetBindCardListListParams,
    params: RequestParams = {},
  ) =>
    this.http.request<UserGetBindCardListListData, any>({
      path: `/user_get_bind_card_list`,
      method: "GET",
      query: query,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Pay
   * @name UserSetAutoRechargeStatusCreate
   * @summary 开启/关闭钱包自动充值
   * @request POST:/user_set_auto_recharge_status
   * @response `200` `UserSetAutoRechargeStatusCreateData`
   */
  userSetAutoRechargeStatusCreate = (
    data: UserSetAutoRechargeStatusCreatePayload,
    params: RequestParams = {},
  ) =>
    this.http.request<UserSetAutoRechargeStatusCreateData, any>({
      path: `/user_set_auto_recharge_status`,
      method: "POST",
      body: data,
      type: ContentType.Json,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Pay
   * @name UserUnbindCardCreate
   * @summary 用户解绑银行卡
   * @request POST:/user_unbind_card
   * @response `200` `UserUnbindCardCreateData`
   */
  userUnbindCardCreate = (
    data: UserUnbindCardCreatePayload,
    params: RequestParams = {},
  ) =>
    this.http.request<UserUnbindCardCreateData, any>({
      path: `/user_unbind_card`,
      method: "POST",
      body: data,
      type: ContentType.Json,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Pay
   * @name UserSetMainCardCreate
   * @summary 设置用户银行卡为主卡
   * @request POST:/user_set_main_card
   * @response `200` `UserSetMainCardCreateData`
   */
  userSetMainCardCreate = (
    data: UserSetMainCardCreatePayload,
    params: RequestParams = {},
  ) =>
    this.http.request<UserSetMainCardCreateData, any>({
      path: `/user_set_main_card`,
      method: "POST",
      body: data,
      type: ContentType.Json,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Pay
   * @name UserGetWindowSubscriptionUpgradeMessageList
   * @summary 获取窗口订阅升级消息
   * @request GET:/user_get_window_subscription_upgrade_message
   * @response `200` `UserGetWindowSubscriptionUpgradeMessageListData`
   */
  userGetWindowSubscriptionUpgradeMessageList = (
    query: UserGetWindowSubscriptionUpgradeMessageListParams,
    params: RequestParams = {},
  ) =>
    this.http.request<UserGetWindowSubscriptionUpgradeMessageListData, any>({
      path: `/user_get_window_subscription_upgrade_message`,
      method: "GET",
      query: query,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Pay
   * @name UserGetStablecoinInfoList
   * @summary 获取加密币支付方式
   * @request GET:/user_get_stablecoin_info
   * @response `200` `UserGetStablecoinInfoListData`
   */
  userGetStablecoinInfoList = (params: RequestParams = {}) =>
    this.http.request<UserGetStablecoinInfoListData, any>({
      path: `/user_get_stablecoin_info`,
      method: "GET",
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Pay
   * @name UserRedeemWindowCodeCreate
   * @summary 窗口兑换码兑换接口
   * @request POST:/user_redeem_window_code
   * @response `200` `UserRedeemWindowCodeCreateData`
   */
  userRedeemWindowCodeCreate = (
    data: UserRedeemWindowCodeCreatePayload,
    params: RequestParams = {},
  ) =>
    this.http.request<UserRedeemWindowCodeCreateData, any>({
      path: `/user_redeem_window_code`,
      method: "POST",
      body: data,
      type: ContentType.Json,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Pay
   * @name UserQueryRedeemCodeList
   * @summary 获取兑换码详情信息
   * @request GET:/user_query_redeem_code
   * @response `200` `UserQueryRedeemCodeListData`
   */
  userQueryRedeemCodeList = (
    query: UserQueryRedeemCodeListParams,
    params: RequestParams = {},
  ) =>
    this.http.request<UserQueryRedeemCodeListData, any>({
      path: `/user_query_redeem_code`,
      method: "GET",
      query: query,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Pay
   * @name UserRedeemCodeListList
   * @summary 兑换码列表查询接口
   * @request GET:/user_redeem_code_list
   * @response `200` `UserRedeemCodeListListData`
   */
  userRedeemCodeListList = (params: RequestParams = {}) =>
    this.http.request<UserRedeemCodeListListData, any>({
      path: `/user_redeem_code_list`,
      method: "GET",
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Pay
   * @name UserPayCaptchaTriggerList
   * @summary 获取用户支付风控验证码信息
   * @request GET:/user_pay_captcha_trigger
   * @response `200` `UserPayCaptchaTriggerListData`
   */
  userPayCaptchaTriggerList = (params: RequestParams = {}) =>
    this.http.request<UserPayCaptchaTriggerListData, any>({
      path: `/user_pay_captcha_trigger`,
      method: "GET",
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Pay
   * @name UserGetPayChannelFeesList
   * @summary 获取用户支付渠道手续费配置
   * @request GET:/user_get_pay_channel_fees
   * @response `200` `UserGetPayChannelFeesListData`
   */
  userGetPayChannelFeesList = (
    query: UserGetPayChannelFeesListParams,
    params: RequestParams = {},
  ) =>
    this.http.request<UserGetPayChannelFeesListData, any>({
      path: `/user_get_pay_channel_fees`,
      method: "GET",
      query: query,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Pay
   * @name UserGetDurationDiscountsByDaysList
   * @summary 获取用户的订阅时长折扣（天）
   * @request GET:/user_get_duration_discounts_by_days
   * @response `200` `UserGetDurationDiscountsByDaysListData`
   */
  userGetDurationDiscountsByDaysList = (
    query: UserGetDurationDiscountsByDaysListParams,
    params: RequestParams = {},
  ) =>
    this.http.request<UserGetDurationDiscountsByDaysListData, any>({
      path: `/user_get_duration_discounts_by_days`,
      method: "GET",
      query: query,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Pay
   * @name UserPermanentWindowSettlementCreate
   * @summary 用户购买终身窗口结算（仅支持钱包支付）
   * @request POST:/user_permanent_window_settlement
   * @response `200` `UserPermanentWindowSettlementCreateData`
   */
  userPermanentWindowSettlementCreate = (
    data: UserPermanentWindowSettlementCreatePayload,
    params: RequestParams = {},
  ) =>
    this.http.request<UserPermanentWindowSettlementCreateData, any>({
      path: `/user_permanent_window_settlement`,
      method: "POST",
      body: data,
      type: ContentType.Json,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Pay
   * @name QueryOrderStatusList
   * @summary 查询订单状态（非鉴权）
   * @request GET:/app_statistics/query_order_status
   * @response `200` `QueryOrderStatusListData`
   */
  queryOrderStatusList = (
    query: QueryOrderStatusListParams,
    params: RequestParams = {},
  ) =>
    this.http.request<QueryOrderStatusListData, any>({
      path: `/app_statistics/query_order_status`,
      method: "GET",
      query: query,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Pay
   * @name UserMidAutumnLotteryPrizesList
   * @summary 中秋活动1：我的奖品 + 待抽次数
   * @request GET:/user_mid_autumn_lottery_prizes
   * @response `200` `UserMidAutumnLotteryPrizesListData`
   */
  userMidAutumnLotteryPrizesList = (params: RequestParams = {}) =>
    this.http.request<UserMidAutumnLotteryPrizesListData, any>({
      path: `/user_mid_autumn_lottery_prizes`,
      method: "GET",
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Pay
   * @name UserMidAutumnLotteryDrawCreate
   * @summary 中秋活动1：每次抽 1 条并到账
   * @request POST:/user_mid_autumn_lottery_draw
   * @response `200` `UserMidAutumnLotteryDrawCreateData`
   */
  userMidAutumnLotteryDrawCreate = (params: RequestParams = {}) =>
    this.http.request<UserMidAutumnLotteryDrawCreateData, any>({
      path: `/user_mid_autumn_lottery_draw`,
      method: "POST",
      format: "json",
      ...params,
    });
  /**
 * @description 返回云手机套餐台数档位、订阅周期、包月开机单价、临时开机时长包、免费体验和下月账单日；本接口不读取请求业务字段，请求示例：{}。成功 code=0、msg=成功，HTTP 200；捕获的服务器异常 code=500、msg=服务器错误，仍为 HTTP 200，且不返回 data（不是 null）。 计价说明：monthlyCents/monthly 是整档每月价格，不是单台价格；monthlyBootUnitCents=2990 美分/台/月（29.90 美元/台/月）。套餐费=整档月价×months×rate，包月开机费=单台月价×包月开机台数×months×rate，分别四舍五入到美分后相加。months 是配置的计价倍数：7天=0.25、30天=1、90天=3、180天=6、360天=12，7天不是 7/30。rate 是实付乘数：1=原价、0.95=支付95%（9.5折）、0.9=支付90%（9折）、0.85=支付85%（8.5折），不是减免比例。时长包 priceCents 已是应付价格，不再按 off 二次打折。免费体验固定1台、30天、30分钟。 nextBillingDate 使用服务器 UTC 当前日期的下月同日，不足则取下月月末，格式 YYYY-MM-DD；例如 UTC 2026-09-17 返回 2026-10-17，2026-01-31 返回 2026-02-28。未查询团队账期，不代表已存在团队订阅的真实账单日。成功 data 及其全部配置字段始终返回，无缺省字段、无 null；响应配置值不是请求默认值，动态日期没有固定默认值。
 *
 * @tags Pay
 * @name UserGetCloudphonePlanOptionsCreate
 * @summary 获取云手机套餐选项
 * @request POST:/user_get_cloudphone_plan_options
 * @response `200` `UserGetCloudphonePlanOptionsCreateData` HTTP 200；code=0、msg=成功，data全部配置字段均返回。完整档位及日期假设见响应示例。
 * @response `x-200-2` `{
  /** 业务码500表示服务器错误；始终返回，不是HTTP状态码。 *\/
    code: CodeEnum1,
  /** 默认中文错误提示服务器错误；始终返回。 *\/
    msg: string,

}` 路由捕获异常时返回业务码500，HTTP仍为200；data字段缺省，不是null。
 */
  userGetCloudphonePlanOptionsCreate = (
    data: UserGetCloudphonePlanOptionsCreatePayload,
    params: RequestParams = {},
  ) =>
    this.http.request<
      UserGetCloudphonePlanOptionsCreateData,
      UserGetCloudphonePlanOptionsCreateError
    >({
      path: `/user_get_cloudphone_plan_options`,
      method: "POST",
      body: data,
      type: ContentType.Json,
      format: "json",
      ...params,
    });
  /**
 * @description 云手机报价，仅计算并校验，不支付、不生成订单、不发货；免费体验报价不校验是否已领取，不读取团队现有套餐或账期。请求product省略默认plan，非全局必填；action省略默认purchase且仅plan使用；qty省略默认0，但plan的purchase/renew/change均业务必填且必须精确匹配台数档位；minutes省略默认0，但time_addon业务必填且必须精确匹配时长档位。term省略默认30天，仅plan purchase/renew用于计价，change忽略。 请求示例： 新购（其余字段用默认值）： ```json {"qty":5} ``` 套餐新购（7天计价倍数为0.25，不是7/30）： ```json {"product":"plan","action":"purchase","qty":5,"monthlyBootQty":1,"term":"7天"} ``` 套餐续期： ```json {"product":"plan","action":"renew","qty":5,"monthlyBootQty":1,"term":"90天"} ``` 套餐变更（term、minutes忽略）： ```json {"product":"plan","action":"change","qty":10,"monthlyBootQty":2} ``` 时长包（只使用product和minutes）： ```json {"product":"time_addon","minutes":2000} ``` 免费体验（只使用product）： ```json {"product":"free_trial"} ``` 计价：tierMonthlyCents是所选整档每月美分价，不是单台价；包月开机单价2990美分/台/月。phoneFeeCents=整档月价×months×rate，monthlyBootFeeCents=2990×monthlyBootQty×months×rate，分别以ROUND_HALF_UP四舍五入到整数美分后相加得到amountCents。months为计价倍数：7/30/90/180/360天分别为0.25/1/3/6/12。rate为实付乘数（1原价、0.95付95%即9.5折、0.9付90%即9折、0.85付85%即8.5折），不是减免比例。时长包直接使用已优惠后的整包价格。change和free_trial金额为0，但本报价接口对所有场景均不实际扣款。 成功响应data是不同product/action结果的字段并集，不是所有字段都存在，条件字段未返回时是缺省，不是null： - plan purchase/renew：返回action、qty、months、rate、off、tierMonthlyCents、phoneFee、monthlyBootFee、expireDate，不返回effectiveDate；其余公共字段均返回，minutes=0。 - plan change：有action、qty、effectiveDate；无off、months、rate、tierMonthlyCents、phoneFee、monthlyBootFee、expireDate，term为空字符串，days/minutes及费用为0。 - time_addon：有off；无qty、action、expireDate、effectiveDate、months、rate、tierMonthlyCents、phoneFee、monthlyBootFee；phoneSlots/monthlyBootQty/days/两项FeeCents为0，term为空字符串，amount/amountCents是整包应付价。 - free_trial：有qty=1；无action、expireDate、effectiveDate、off、months、rate、tierMonthlyCents、phoneFee、monthlyBootFee；phoneSlots=1、days=30、minutes=30、term=30天，monthlyBootQty及所有返回的费用为0。 expireDate仅plan purchase/renew返回，按服务器UTC当前日期+days计算YYYY-MM-DD；续期报价也不是读取原到期日后延长。effectiveDate仅plan change返回，按UTC当前日期下月同日、不足取月末计算；未查询团队账期。例如UTC当前日2026-09-17：7天expireDate=2026-09-24，90天expireDate=2026-12-16，effectiveDate=2026-10-17；UTC 2026-01-31的下月同日回退为2026-02-28。 HTTP状态与业务码分离：成功HTTP200，code=0，msg=成功；业务校验失败HTTP200，code=101，msg为具体原因，无data字段（不是null）；路由捕获服务器异常也HTTP200，code=500，msg=服务器错误，无data。101可能原因包括云手机数量必须为可选档位之一、订阅时长无效、包月开机数量无效、包月开机数量不能超过云手机数量、支付金额必须大于0、action 无效、时长包档位无效、product 无效。
 *
 * @tags Pay
 * @name UserCloudphoneQuoteCreate
 * @summary 云手机报价
 * @request POST:/user_cloudphone_quote
 * @response `200` `UserCloudphoneQuoteCreateData` HTTP200，code=0、msg=成功。data为四种不同返回结构的字段并集，条件字段不能全标必填；新购与续期结构相同，change/time_addon/free_trial各不同。未返回字段均缺省而非null。
 * @response `x-200-2` `{
  /** 业务码101表示参数或业务校验错误；始终返回，不是HTTP状态码。 *\/
    code: CodeEnum3,
  /** 具体错误原因，始终返回；例如云手机数量必须为可选档位之一、订阅时长无效、包月开机数量无效、包月开机数量不能超过云手机数量、支付金额必须大于0、action 无效、时长包档位无效、product 无效。未提供自定义提示时通用默认值为参数错误；此路由正常业务错误使用具体原因。 *\/
    msg: string,

}` 报价业务校验失败；HTTP200，code=101，msg具体中文原因，无data字段（不是null）。例如请求{"product":"plan","qty":6}不是精确台数档位。
 * @response `x-200-3` `{
  /** 业务码500表示服务器错误；始终返回，不是HTTP状态码。 *\/
    code: CodeEnum4,
  /** 默认中文错误提示服务器错误；始终返回。 *\/
    msg: string,

}` 路由捕获服务器异常，HTTP仍200，业务码500；无data字段（不是null）。
 */
  userCloudphoneQuoteCreate = (
    data: UserCloudphoneQuoteCreatePayload,
    params: RequestParams = {},
  ) =>
    this.http.request<
      UserCloudphoneQuoteCreateData,
      UserCloudphoneQuoteCreateError
    >({
      path: `/user_cloudphone_quote`,
      method: "POST",
      body: data,
      type: ContentType.Json,
      format: "json",
      ...params,
    });
  /**
 * @description 钱包结算云手机商品：plan 套餐新购/续期、time_addon 临时开机时长包、free_trial 免费体验；plan + change 改套餐不扣款并写入零美元订单。teamId 为大于 0 的云手机团队整数 ID，不是 workspaceId；product 默认 plan，qty 仅在 product=plan 时业务必填，必须指定可选档位。套餐按请求台数、包月开机数、订阅时长计价，不查询当前套餐补全参数；autoRenew 省略默认 true，并非保持原值，非套餐强制 false。免费体验按用户检查是否已领取，固定 1 台/30 天/30 分钟。actualAmount 单位为美元，不是美分。expireDate 为 UTC 当前日期加订阅天数，不是读取现有到期日后延长；effectiveDate 为 UTC 当前日的下个月同日（不足取月末），不是读取团队账期。订单落库/扣款后通知 cloudphone-server 发货；delivered=false 仍可返回业务成功，可能已扣款，由后台 OrderTask 补发，不要重复下单。改套餐 delivered=true 仅表示变更提交成功，pending=true 表示待生效，不能视为套餐立即生效。成功 HTTP 200、code=0、msg=成功，data 固定包含 16 个字段；参数/业务错误 HTTP 200、code=101，异常 HTTP 200、code=500，错误响应无 data。
 *
 * @tags Pay
 * @name UserCloudphoneSettlementCreate
 * @summary 云手机结算
 * @request POST:/user_cloudphone_settlement
 * @response `200` `UserCloudphoneSettlementCreateData` 成功：HTTP 200、业务code=0、msg=成功。即使delivered=false也可能已扣款，后台补发，不要重复下单；改套餐pending=true待生效。
 * @response `x-200-2` `{
  /** 业务错误码101，HTTP状态仍为200。 *\/
    code: number,
  /** 具体中文错误原因，例如teamId不能为空、云手机数量必须为可选档位之一、订阅时长无效、时长包档位无效、只支持钱包支付、已领取过免费体验或钱包余额不足等业务错误。 *\/
    msg: string,

}` HTTP 200，业务code=101；错误无data。
 * @response `x-200-3` `{
  /** 服务器异常业务码500，不是HTTP状态码；HTTP仍为200。 *\/
    code: number,
  /** 默认中文服务器错误提示。 *\/
    msg: string,

}` HTTP 200，业务code=500，msg=服务器错误；错误无data。
 */
  userCloudphoneSettlementCreate = (
    data: UserCloudphoneSettlementCreatePayload,
    params: RequestParams = {},
  ) =>
    this.http.request<
      UserCloudphoneSettlementCreateData,
      UserCloudphoneSettlementCreateError
    >({
      path: `/user_cloudphone_settlement`,
      method: "POST",
      body: data,
      type: ContentType.Json,
      format: "json",
      ...params,
    });
  /**
 * @description 云手机改套餐：按请求指定的套餐台数及包月开机台数提交变更，不查询现有套餐补全参数；不扣款，生成零美元订单，并通知cloudphone-server延后生效。teamId和qty均业务必填：teamId是大于0的云手机团队整数ID，不是workspaceId；qty必须选有效档位。monthlyBootQty省略为0；autoRenew省略默认true，不是保持原值。内部固定product=plan、action=change，不接受订阅周期或分钟包作为改套餐规格。effectiveDate按UTC当前日的下个月同日计算（不足取月末），不是查询团队账期；expireDate为空字符串。delivered=true仅表示变更提交成功，pending=true仍表示待生效，不能视为已立即更换套餐。delivered=false由后台OrderTask补发，不要重复下单；通用付费订单出现此状态可能已扣款，本接口actualAmount恒为0美元。成功HTTP200、code=0、msg=成功，data固定包含16字段；参数/业务错误HTTP200、code=101，异常HTTP200、code=500，错误均无data。
 *
 * @tags Pay
 * @name UserCloudphonePlanChangeCreate
 * @summary 云手机改套餐
 * @request POST:/user_cloudphone_plan_change
 * @response `200` `UserCloudphonePlanChangeCreateData` HTTP200、code=0、msg=成功。本次不扣款；delivered=true仅提交成功，pending=true仍待生效，delivered=false后台补发，不要重复下单。
 * @response `x-200-2` `{
  /** 参数或业务错误码101，HTTP状态仍为200。 *\/
    code: number,
  /** 具体中文错误原因，例如云手机数量必须为可选档位之一、包月开机数量无效、teamId不能为空；写单失败也可能以业务错误返回。 *\/
    msg: string,

}` HTTP200、业务code101，无data。
 * @response `x-200-3` `{
  /** 服务器异常业务码500，不是HTTP状态码；HTTP仍为200。 *\/
    code: number,
  /** 默认中文服务器错误提示。 *\/
    msg: string,

}` HTTP200、业务code500、msg=服务器错误，无data。
 */
  userCloudphonePlanChangeCreate = (
    data: UserCloudphonePlanChangeCreatePayload,
    params: RequestParams = {},
  ) =>
    this.http.request<
      UserCloudphonePlanChangeCreateData,
      UserCloudphonePlanChangeCreateError
    >({
      path: `/user_cloudphone_plan_change`,
      method: "POST",
      body: data,
      type: ContentType.Json,
      format: "json",
      ...params,
    });
  /**
 * @description 云手机套餐续期：按本次请求明确指定的套餐台数、包月开机数及订阅时长计算费用，钱包扣款后发货；不查询当前套餐台数或包月开机数补全参数。teamId、qty业务必填；teamId是大于0的云手机团队整数ID，不是workspaceId，qty必须指定可选档位。payType可省略，非空仅支持Balance；monthlyBootQty省略默认0，autoRenew省略默认true，不是保持原值。虽然复用结算请求模型，本接口忽略传入的product/action/minutes，内部固定product=plan、action=renew、minutes=0。expireDate是UTC当前日期+所选订阅天数，不是查询现有到期日后延长，也不是查询发货后的实际到期日；effectiveDate为空字符串（通用改套餐才按UTC下个月同日计算，不查询团队账期）。actualAmount单位美元而非美分。delivered=true表示发货回调成功；delivered=false仍可能已扣款且后台OrderTask会补发，不要重复下单；pending固定false。成功HTTP200、业务code=0、msg=成功，data固定包含16字段；参数/业务错误HTTP200、code=101，异常HTTP200、code=500，错误无data。
 *
 * @tags Pay
 * @name UserCloudphonePlanRenewCreate
 * @summary 云手机续期
 * @request POST:/user_cloudphone_plan_renew
 * @response `200` `UserCloudphonePlanRenewCreateData` HTTP200、业务code=0、msg=成功；delivered=false也可能已扣款，等待后台补发，不要重复下单。
 * @response `x-200-2` `{
  /** 参数或业务错误码101，HTTP状态仍为200。 *\/
    code: number,
  /** 具体中文错误原因，例如云手机数量必须为可选档位之一、订阅时长无效、包月开机数量不能超过云手机数量、teamId不能为空、只支持钱包支付或钱包余额不足等业务错误。 *\/
    msg: string,

}` HTTP200、业务code101，无data。
 * @response `x-200-3` `{
  /** 服务器异常业务码500，不是HTTP状态码；HTTP仍为200。 *\/
    code: number,
  /** 默认中文服务器错误提示。 *\/
    msg: string,

}` HTTP200、业务code500、msg=服务器错误，无data。
 */
  userCloudphonePlanRenewCreate = (
    data: UserCloudphonePlanRenewCreatePayload,
    params: RequestParams = {},
  ) =>
    this.http.request<
      UserCloudphonePlanRenewCreateData,
      UserCloudphonePlanRenewCreateError
    >({
      path: `/user_cloudphone_plan_renew`,
      method: "POST",
      body: data,
      type: ContentType.Json,
      format: "json",
      ...params,
    });
}
