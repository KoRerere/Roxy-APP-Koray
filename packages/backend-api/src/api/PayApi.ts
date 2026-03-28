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
  UserDowngradeSubscriptionListData,
  UserDowngradeSubscriptionListParams,
  UserDowngradeSubscriptionV2ListData,
  UserDowngradeSubscriptionV2ListParams,
  UserGetAutoSubscriptionInfoListData,
  UserGetAutoSubscriptionInfoListParams,
  UserGetBindCardListListData,
  UserGetBindCardListListParams,
  UserGetDowngradeSubscriptionInfoListData,
  UserGetDurationDiscountsListData,
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
  UserPayCaptchaTriggerListData,
  UserPaySettlementCreateData,
  UserPaySettlementCreatePayload,
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
}
