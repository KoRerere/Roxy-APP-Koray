/* eslint-disable */
/* tslint:disable */
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
  UserCalculatePriceDifferenceListData,
  UserCalculatePriceDifferenceListParams,
  UserCalculateWindowMonthsPriceListData,
  UserCalculateWindowMonthsPriceListParams,
  UserCancelSubscriptionListData,
  UserCancelSubscriptionListParams,
  UserDowngradeSubscriptionListData,
  UserDowngradeSubscriptionListParams,
  UserGetDowngradeSubscriptionInfoListData,
  UserGetDurationDiscountsListData,
  UserGetPayLinkListData,
  UserGetPayLinkListParams,
  UserGetPurchaseRecordsInfoListData,
  UserGetPurchaseRecordsInfoListParams,
  UserGetSupportPayTypeListData,
  UserGetSupportPayTypeListParams,
  UserGetUserPayInfoListData,
  UserGetWindowPricingRulesListListData,
  UserManageSubscriptionListData,
  UserManageSubscriptionListParams,
  UserPaySettlementCreateData,
  UserPaySettlementCreatePayload,
  UserQueryOrderStatusListData,
  UserQueryOrderStatusListParams,
  UserRechargeSettlementCreateData,
  UserRechargeSettlementCreatePayload,
  UserSevenDayTrialCreateData,
  UserSevenDayTrialCreatePayload,
  UserUpdateGiftTipsListData,
  UserUpdatePayTipsListData,
  UserUpdatePayTipsListParams,
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
   * @name UserPaySettlementCreate
   * @summary 用户付费结算
   * @request POST:/user_pay_settlement
   * @response `200` `UserPaySettlementCreateData`
   */
  userPaySettlementCreate = (data: UserPaySettlementCreatePayload, params: RequestParams = {}) =>
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
   * @name UserGetPurchaseRecordsInfoList
   * @summary 获取用户购买记录详细信息
   * @request GET:/user_get_purchase_records_info
   * @response `200` `UserGetPurchaseRecordsInfoListData`
   */
  userGetPurchaseRecordsInfoList = (query: UserGetPurchaseRecordsInfoListParams, params: RequestParams = {}) =>
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
   * @name UserRechargeSettlementCreate
   * @summary 用户充值结算
   * @request POST:/user_recharge_settlement
   * @response `200` `UserRechargeSettlementCreateData`
   */
  userRechargeSettlementCreate = (data: UserRechargeSettlementCreatePayload, params: RequestParams = {}) =>
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
   * @name UserSevenDayTrialCreate
   * @summary 用户7天试用
   * @request POST:/user_seven_day_trial
   * @response `200` `UserSevenDayTrialCreateData`
   */
  userSevenDayTrialCreate = (data: UserSevenDayTrialCreatePayload, params: RequestParams = {}) =>
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
   * @name UserGetSupportPayTypeList
   * @summary 获取支付方式
   * @request GET:/user_get_support_pay_type
   * @response `200` `UserGetSupportPayTypeListData`
   */
  userGetSupportPayTypeList = (query: UserGetSupportPayTypeListParams, params: RequestParams = {}) =>
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
  userQueryOrderStatusList = (query: UserQueryOrderStatusListParams, params: RequestParams = {}) =>
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
  userGetPayLinkList = (query: UserGetPayLinkListParams, params: RequestParams = {}) =>
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
   * @name UserCalculatePriceDifferenceList
   * @summary 用户计算差价
   * @request GET:/user_calculate_price_difference
   * @response `200` `UserCalculatePriceDifferenceListData`
   */
  userCalculatePriceDifferenceList = (query: UserCalculatePriceDifferenceListParams, params: RequestParams = {}) =>
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
   * @name UserManageSubscriptionList
   * @summary 管理订阅
   * @request GET:/user_manage_subscription
   * @response `200` `UserManageSubscriptionListData`
   */
  userManageSubscriptionList = (query: UserManageSubscriptionListParams, params: RequestParams = {}) =>
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
   * @name UserUpdatePayTipsList
   * @summary 修改付费提示
   * @request GET:/user_update_pay_tips
   * @response `200` `UserUpdatePayTipsListData`
   */
  userUpdatePayTipsList = (query: UserUpdatePayTipsListParams, params: RequestParams = {}) =>
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
  userCalculateWindowMonthsPriceList = (query: UserCalculateWindowMonthsPriceListParams, params: RequestParams = {}) =>
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
   * @name UserCancelSubscriptionList
   * @summary 取消订阅
   * @request GET:/user_cancel_subscription
   * @response `200` `UserCancelSubscriptionListData`
   */
  userCancelSubscriptionList = (query: UserCancelSubscriptionListParams, params: RequestParams = {}) =>
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
   * @summary 降级订阅
   * @request GET:/user_downgrade_subscription
   * @response `200` `UserDowngradeSubscriptionListData`
   */
  userDowngradeSubscriptionList = (query: UserDowngradeSubscriptionListParams, params: RequestParams = {}) =>
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
   * @name UserAutoRenewUpgradeList
   * @summary 自动续费升级套餐
   * @request GET:/user_auto_renew_upgrade
   * @response `200` `UserAutoRenewUpgradeListData`
   */
  userAutoRenewUpgradeList = (query: UserAutoRenewUpgradeListParams, params: RequestParams = {}) =>
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
}
