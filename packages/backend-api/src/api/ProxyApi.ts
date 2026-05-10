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
  GetConsumptionGiftIpConfigListData,
  UserAddProxyModuleCreateData,
  UserAddProxyModuleCreatePayload,
  UserBatchMdfProxyModuleCheckCreateData,
  UserBatchMdfProxyModuleCheckCreatePayload,
  UserCheckProxyCreateData,
  UserCheckProxyCreatePayload,
  UserCheckWindowProxyStatusCreateData,
  UserCheckWindowProxyStatusCreatePayload,
  UserDelProxyModuleV2CreateData,
  UserDelProxyModuleV2CreatePayload,
  UserGetPromotionRedeemCodeListListData,
  UserGetPromotionRedeemCodeListListParams,
  UserGetProxyAllCountriesListData,
  UserGetProxyAllCountriesListParams,
  UserGetProxyBusinessSceneListListData,
  UserGetProxyBusinessSceneListListParams,
  UserGetProxyBusinessUseListListData,
  UserGetProxyCountryListByContinentListData,
  UserGetProxyCountryListByContinentListParams,
  UserGetProxyCountryPriceListListData,
  UserGetProxyCountryPriceListListParams,
  UserGetProxyListMergedListData,
  UserGetProxyListMergedListParams,
  UserGetProxyModuleListData,
  UserGetProxyModuleListParams,
  UserGetProxyProviderListListData,
  UserGetProxyProvidersByBusinessSceneListData,
  UserGetProxyProvidersByBusinessSceneListParams,
  UserGetProxyProvidersTypeListData,
  UserGetProxyPurchaseCountryListListData,
  UserGetProxyPurchaseCountryListListParams,
  UserGetProxyPurchaseTimePriceListData,
  UserGetProxyPurchaseTimePriceListParams,
  UserGetProxyRecommendInfoListData,
  UserGetProxyRefundInfoListData,
  UserGetProxyRefundInfoListParams,
  UserGetProxyStoreListListData,
  UserGetProxyTableRowsListData,
  UserGetProxyTableSortOrderListData,
  UserGetProxyVendorJumpInfoListData,
  UserGetProxyVendorJumpInfoListParams,
  UserGetProxyVendorListListData,
  UserGetTimezoneByCoordinatesInfoListData,
  UserGetTimezoneByCoordinatesInfoListParams,
  UserGetTimezoneByIpListData,
  UserGetTimezoneByIpListParams,
  UserGetUserBuyProxyListListData,
  UserGetUserBuyProxyListListParams,
  UserMdfProxyModuleCreateData,
  UserMdfProxyModuleCreatePayload,
  UserMdfUserBuyProxyRemarkCreateData,
  UserMdfUserBuyProxyRemarkCreatePayload,
  UserProxyRefundOrReplaceCreateData,
  UserProxyRefundOrReplaceCreatePayload,
  UserRedeemProxyCodeCreateData,
  UserRedeemProxyCodeCreatePayload,
  UserRegisterProxyProviderUserCreateData,
  UserRegisterProxyProviderUserCreatePayload,
  UserReportProxyOutOfStockCreateData,
  UserReportProxyOutOfStockCreatePayload,
  UserSaveProxyTableSortOrderCreateData,
  UserSaveProxyTableSortOrderCreatePayload,
  UserSetProxyAutoRenewalCreateData,
  UserSetProxyAutoRenewalCreatePayload,
  UserUpdateProxyTableRowsCreateData,
  UserUpdateProxyTableRowsCreatePayload,
} from "./data-contracts";
import { ContentType, HttpClient, RequestParams } from "./http-client";

export class ProxyApi<SecurityDataType = unknown> {
  http: HttpClient<SecurityDataType>;

  constructor(http: HttpClient<SecurityDataType>) {
    this.http = http;
  }

  /**
   * No description
   *
   * @tags Proxy
   * @name UserGetProxyModuleList
   * @summary 代理IP列表
   * @request GET:/user_get_proxy_module
   * @response `200` `UserGetProxyModuleListData`
   */
  userGetProxyModuleList = (
    query: UserGetProxyModuleListParams,
    params: RequestParams = {},
  ) =>
    this.http.request<UserGetProxyModuleListData, any>({
      path: `/user_get_proxy_module`,
      method: "GET",
      query: query,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Proxy
   * @name UserAddProxyModuleCreate
   * @summary 批量导入代理
   * @request POST:/user_add_proxy_module
   * @response `200` `UserAddProxyModuleCreateData`
   */
  userAddProxyModuleCreate = (
    data: UserAddProxyModuleCreatePayload,
    params: RequestParams = {},
  ) =>
    this.http.request<UserAddProxyModuleCreateData, any>({
      path: `/user_add_proxy_module`,
      method: "POST",
      body: data,
      type: ContentType.Json,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Proxy
   * @name UserMdfProxyModuleCreate
   * @summary 单个代理修改
   * @request POST:/user_mdf_proxy_module
   * @response `200` `UserMdfProxyModuleCreateData`
   */
  userMdfProxyModuleCreate = (
    data: UserMdfProxyModuleCreatePayload,
    params: RequestParams = {},
  ) =>
    this.http.request<UserMdfProxyModuleCreateData, any>({
      path: `/user_mdf_proxy_module`,
      method: "POST",
      body: data,
      type: ContentType.Json,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Proxy
   * @name UserDelProxyModuleV2Create
   * @summary 批量删除代理
   * @request POST:/user_del_proxy_module_v2
   * @response `200` `UserDelProxyModuleV2CreateData`
   */
  userDelProxyModuleV2Create = (
    data: UserDelProxyModuleV2CreatePayload,
    params: RequestParams = {},
  ) =>
    this.http.request<UserDelProxyModuleV2CreateData, any>({
      path: `/user_del_proxy_module_v2`,
      method: "POST",
      body: data,
      type: ContentType.Json,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Proxy
   * @name UserGetProxyTableSortOrderList
   * @summary 获取代理列表排序规则
   * @request GET:/user_get_proxy_table_sort_order
   * @response `200` `UserGetProxyTableSortOrderListData`
   */
  userGetProxyTableSortOrderList = (params: RequestParams = {}) =>
    this.http.request<UserGetProxyTableSortOrderListData, any>({
      path: `/user_get_proxy_table_sort_order`,
      method: "GET",
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Proxy
   * @name UserSaveProxyTableSortOrderCreate
   * @summary 保存代理列表排序规则）
   * @request POST:/user_save_proxy_table_sort_order
   * @response `200` `UserSaveProxyTableSortOrderCreateData`
   */
  userSaveProxyTableSortOrderCreate = (
    data: UserSaveProxyTableSortOrderCreatePayload,
    params: RequestParams = {},
  ) =>
    this.http.request<UserSaveProxyTableSortOrderCreateData, any>({
      path: `/user_save_proxy_table_sort_order`,
      method: "POST",
      body: data,
      type: ContentType.Json,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Proxy
   * @name UserGetProxyTableRowsList
   * @summary 获取代理表格列顺序
   * @request GET:/user_get_proxy_table_rows
   * @response `200` `UserGetProxyTableRowsListData`
   */
  userGetProxyTableRowsList = (params: RequestParams = {}) =>
    this.http.request<UserGetProxyTableRowsListData, any>({
      path: `/user_get_proxy_table_rows`,
      method: "GET",
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Proxy
   * @name UserUpdateProxyTableRowsCreate
   * @summary 修改代理表格列顺序
   * @request POST:/user_update_proxy_table_rows
   * @response `200` `UserUpdateProxyTableRowsCreateData`
   */
  userUpdateProxyTableRowsCreate = (
    data: UserUpdateProxyTableRowsCreatePayload,
    params: RequestParams = {},
  ) =>
    this.http.request<UserUpdateProxyTableRowsCreateData, any>({
      path: `/user_update_proxy_table_rows`,
      method: "POST",
      body: data,
      type: ContentType.Json,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Proxy
   * @name UserGetProxyRecommendInfoList
   * @summary 代理推荐列表
   * @request GET:/user_get_proxy_recommend_info
   * @response `200` `UserGetProxyRecommendInfoListData`
   */
  userGetProxyRecommendInfoList = (params: RequestParams = {}) =>
    this.http.request<UserGetProxyRecommendInfoListData, any>({
      path: `/user_get_proxy_recommend_info`,
      method: "GET",
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Proxy
   * @name UserGetTimezoneByCoordinatesInfoList
   * @summary 根据经纬度获取时区
   * @request GET:/user_get_timezone_by_coordinates_info
   * @response `200` `UserGetTimezoneByCoordinatesInfoListData`
   */
  userGetTimezoneByCoordinatesInfoList = (
    query: UserGetTimezoneByCoordinatesInfoListParams,
    params: RequestParams = {},
  ) =>
    this.http.request<UserGetTimezoneByCoordinatesInfoListData, any>({
      path: `/user_get_timezone_by_coordinates_info`,
      method: "GET",
      query: query,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Proxy
   * @name UserGetUserBuyProxyListList
   * @summary 获取用户购买的代理列表
   * @request GET:/user_get_user_buy_proxy_list
   * @response `200` `UserGetUserBuyProxyListListData`
   */
  userGetUserBuyProxyListList = (
    query: UserGetUserBuyProxyListListParams,
    params: RequestParams = {},
  ) =>
    this.http.request<UserGetUserBuyProxyListListData, any>({
      path: `/user_get_user_buy_proxy_list`,
      method: "GET",
      query: query,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Proxy
   * @name UserGetProxyProviderListList
   * @summary 获取代理供应商列表
   * @request GET:/user_get_proxy_provider_list
   * @response `200` `UserGetProxyProviderListListData`
   */
  userGetProxyProviderListList = (params: RequestParams = {}) =>
    this.http.request<UserGetProxyProviderListListData, any>({
      path: `/user_get_proxy_provider_list`,
      method: "GET",
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Proxy
   * @name UserGetProxyBusinessUseListList
   * @summary 获取代理商业用途列表
   * @request GET:/user_get_proxy_business_use_list
   * @response `200` `UserGetProxyBusinessUseListListData`
   */
  userGetProxyBusinessUseListList = (params: RequestParams = {}) =>
    this.http.request<UserGetProxyBusinessUseListListData, any>({
      path: `/user_get_proxy_business_use_list`,
      method: "GET",
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Proxy
   * @name UserGetProxyPurchaseCountryListList
   * @summary 获取代理购买国家
   * @request GET:/user_get_proxy_purchase_country_list
   * @response `200` `UserGetProxyPurchaseCountryListListData`
   */
  userGetProxyPurchaseCountryListList = (
    query: UserGetProxyPurchaseCountryListListParams,
    params: RequestParams = {},
  ) =>
    this.http.request<UserGetProxyPurchaseCountryListListData, any>({
      path: `/user_get_proxy_purchase_country_list`,
      method: "GET",
      query: query,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Proxy
   * @name UserGetProxyPurchaseTimePriceList
   * @summary 获取代理购买时长单价
   * @request GET:/user_get_proxy_purchase_time_price
   * @response `200` `UserGetProxyPurchaseTimePriceListData`
   */
  userGetProxyPurchaseTimePriceList = (
    query: UserGetProxyPurchaseTimePriceListParams,
    params: RequestParams = {},
  ) =>
    this.http.request<UserGetProxyPurchaseTimePriceListData, any>({
      path: `/user_get_proxy_purchase_time_price`,
      method: "GET",
      query: query,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Proxy
   * @name UserMdfUserBuyProxyRemarkCreate
   * @summary 修改用户购买的代理备注
   * @request POST:/user_mdf_user_buy_proxy_remark
   * @response `200` `UserMdfUserBuyProxyRemarkCreateData`
   */
  userMdfUserBuyProxyRemarkCreate = (
    data: UserMdfUserBuyProxyRemarkCreatePayload,
    params: RequestParams = {},
  ) =>
    this.http.request<UserMdfUserBuyProxyRemarkCreateData, any>({
      path: `/user_mdf_user_buy_proxy_remark`,
      method: "POST",
      body: data,
      type: ContentType.Json,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Proxy
   * @name UserProxyRefundOrReplaceCreate
   * @summary 用户代理退款或者更换
   * @request POST:/user_proxy_refund_or_replace
   * @response `200` `UserProxyRefundOrReplaceCreateData`
   */
  userProxyRefundOrReplaceCreate = (
    data: UserProxyRefundOrReplaceCreatePayload,
    params: RequestParams = {},
  ) =>
    this.http.request<UserProxyRefundOrReplaceCreateData, any>({
      path: `/user_proxy_refund_or_replace`,
      method: "POST",
      body: data,
      type: ContentType.Json,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Proxy
   * @name UserCheckProxyCreate
   * @summary 检测代理
   * @request POST:/user_check_proxy
   * @response `200` `UserCheckProxyCreateData`
   */
  userCheckProxyCreate = (
    data: UserCheckProxyCreatePayload,
    params: RequestParams = {},
  ) =>
    this.http.request<UserCheckProxyCreateData, any>({
      path: `/user_check_proxy`,
      method: "POST",
      body: data,
      type: ContentType.Json,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Proxy
   * @name UserCheckWindowProxyStatusCreate
   * @summary 校验窗口的代理状态
   * @request POST:/user_check_window_proxy_status
   * @response `200` `UserCheckWindowProxyStatusCreateData`
   */
  userCheckWindowProxyStatusCreate = (
    data: UserCheckWindowProxyStatusCreatePayload,
    params: RequestParams = {},
  ) =>
    this.http.request<UserCheckWindowProxyStatusCreateData, any>({
      path: `/user_check_window_proxy_status`,
      method: "POST",
      body: data,
      type: ContentType.Json,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Proxy
   * @name UserGetProxyRefundInfoList
   * @summary 获取代理退款详细信息
   * @request GET:/user_get_proxy_refund_info
   * @response `200` `UserGetProxyRefundInfoListData`
   */
  userGetProxyRefundInfoList = (
    query: UserGetProxyRefundInfoListParams,
    params: RequestParams = {},
  ) =>
    this.http.request<UserGetProxyRefundInfoListData, any>({
      path: `/user_get_proxy_refund_info`,
      method: "GET",
      query: query,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Proxy
   * @name UserGetProxyAllCountriesList
   * @summary 获取代理列表国家地区
   * @request GET:/user_get_proxy_all_countries
   * @response `200` `UserGetProxyAllCountriesListData`
   */
  userGetProxyAllCountriesList = (
    query: UserGetProxyAllCountriesListParams,
    params: RequestParams = {},
  ) =>
    this.http.request<UserGetProxyAllCountriesListData, any>({
      path: `/user_get_proxy_all_countries`,
      method: "GET",
      query: query,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Proxy
   * @name UserGetTimezoneByIpList
   * @summary 根据IP地址获取时区
   * @request GET:/user_get_timezone_by_ip
   * @response `200` `UserGetTimezoneByIpListData`
   */
  userGetTimezoneByIpList = (
    query: UserGetTimezoneByIpListParams,
    params: RequestParams = {},
  ) =>
    this.http.request<UserGetTimezoneByIpListData, any>({
      path: `/user_get_timezone_by_ip`,
      method: "GET",
      query: query,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Proxy
   * @name UserGetPromotionRedeemCodeListList
   * @summary 查询未使用的代理IP活动兑换码
   * @request GET:/user_get_promotion_redeem_code_list
   * @response `200` `UserGetPromotionRedeemCodeListListData`
   */
  userGetPromotionRedeemCodeListList = (
    query: UserGetPromotionRedeemCodeListListParams,
    params: RequestParams = {},
  ) =>
    this.http.request<UserGetPromotionRedeemCodeListListData, any>({
      path: `/user_get_promotion_redeem_code_list`,
      method: "GET",
      query: query,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Proxy
   * @name UserRedeemProxyCodeCreate
   * @summary 代理IP奖励兑换
   * @request POST:/user_redeem_proxy_code
   * @response `200` `UserRedeemProxyCodeCreateData`
   */
  userRedeemProxyCodeCreate = (
    data: UserRedeemProxyCodeCreatePayload,
    params: RequestParams = {},
  ) =>
    this.http.request<UserRedeemProxyCodeCreateData, any>({
      path: `/user_redeem_proxy_code`,
      method: "POST",
      body: data,
      type: ContentType.Json,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Proxy
   * @name UserSetProxyAutoRenewalCreate
   * @summary 用户开启/关闭代理IP自动续费
   * @request POST:/user_set_proxy_auto_renewal
   * @response `200` `UserSetProxyAutoRenewalCreateData`
   */
  userSetProxyAutoRenewalCreate = (
    data: UserSetProxyAutoRenewalCreatePayload,
    params: RequestParams = {},
  ) =>
    this.http.request<UserSetProxyAutoRenewalCreateData, any>({
      path: `/user_set_proxy_auto_renewal`,
      method: "POST",
      body: data,
      type: ContentType.Json,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Proxy
   * @name UserGetProxyProvidersTypeList
   * @summary 获取代理类型
   * @request GET:/user_get_proxy_providers_type
   * @response `200` `UserGetProxyProvidersTypeListData`
   */
  userGetProxyProvidersTypeList = (params: RequestParams = {}) =>
    this.http.request<UserGetProxyProvidersTypeListData, any>({
      path: `/user_get_proxy_providers_type`,
      method: "GET",
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Proxy
   * @name UserRegisterProxyProviderUserCreate
   * @summary 注册代理供应商用户
   * @request POST:/user_register_proxy_provider_user
   * @response `200` `UserRegisterProxyProviderUserCreateData`
   */
  userRegisterProxyProviderUserCreate = (
    data: UserRegisterProxyProviderUserCreatePayload,
    params: RequestParams = {},
  ) =>
    this.http.request<UserRegisterProxyProviderUserCreateData, any>({
      path: `/user_register_proxy_provider_user`,
      method: "POST",
      body: data,
      type: ContentType.Json,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Proxy
   * @name UserGetProxyStoreListList
   * @summary 获取代理商店列表（简化版）
   * @request GET:/user_get_proxy_store_list
   * @response `200` `UserGetProxyStoreListListData`
   */
  userGetProxyStoreListList = (params: RequestParams = {}) =>
    this.http.request<UserGetProxyStoreListListData, any>({
      path: `/user_get_proxy_store_list`,
      method: "GET",
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Proxy
   * @name GetConsumptionGiftIpConfigList
   * @summary 获取消费赠送IP配置信息
   * @request GET:/get_consumption_gift_ip_config
   * @response `200` `GetConsumptionGiftIpConfigListData`
   */
  getConsumptionGiftIpConfigList = (params: RequestParams = {}) =>
    this.http.request<GetConsumptionGiftIpConfigListData, any>({
      path: `/get_consumption_gift_ip_config`,
      method: "GET",
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Proxy
   * @name UserGetProxyCountryPriceListList
   * @summary 获取代理国家价格信息
   * @request GET:/user_get_proxy_country_price_list
   * @response `200` `UserGetProxyCountryPriceListListData`
   */
  userGetProxyCountryPriceListList = (
    query: UserGetProxyCountryPriceListListParams,
    params: RequestParams = {},
  ) =>
    this.http.request<UserGetProxyCountryPriceListListData, any>({
      path: `/user_get_proxy_country_price_list`,
      method: "GET",
      query: query,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Proxy
   * @name UserGetProxyListMergedList
   * @summary 获取代理列表(代理商店+代理列表)
   * @request GET:/user_get_proxy_list_merged
   * @response `200` `UserGetProxyListMergedListData`
   */
  userGetProxyListMergedList = (
    query: UserGetProxyListMergedListParams,
    params: RequestParams = {},
  ) =>
    this.http.request<UserGetProxyListMergedListData, any>({
      path: `/user_get_proxy_list_merged`,
      method: "GET",
      query: query,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Proxy
   * @name UserGetProxyVendorListList
   * @summary 获取代理厂商列表
   * @request GET:/user_get_proxy_vendor_list
   * @response `200` `UserGetProxyVendorListListData`
   */
  userGetProxyVendorListList = (params: RequestParams = {}) =>
    this.http.request<UserGetProxyVendorListListData, any>({
      path: `/user_get_proxy_vendor_list`,
      method: "GET",
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Proxy
   * @name UserGetProxyBusinessSceneListList
   * @summary 获取代理业务用途场景列表
   * @request GET:/user_get_proxy_business_scene_list
   * @response `200` `UserGetProxyBusinessSceneListListData`
   */
  userGetProxyBusinessSceneListList = (
    query: UserGetProxyBusinessSceneListListParams,
    params: RequestParams = {},
  ) =>
    this.http.request<UserGetProxyBusinessSceneListListData, any>({
      path: `/user_get_proxy_business_scene_list`,
      method: "GET",
      query: query,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Proxy
   * @name UserGetProxyProvidersByBusinessSceneList
   * @summary 按业务场景ID获取关联代理供应商列表
   * @request GET:/user_get_proxy_providers_by_business_scene
   * @response `200` `UserGetProxyProvidersByBusinessSceneListData`
   */
  userGetProxyProvidersByBusinessSceneList = (
    query: UserGetProxyProvidersByBusinessSceneListParams,
    params: RequestParams = {},
  ) =>
    this.http.request<UserGetProxyProvidersByBusinessSceneListData, any>({
      path: `/user_get_proxy_providers_by_business_scene`,
      method: "GET",
      query: query,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Proxy
   * @name UserGetProxyCountryListByContinentList
   * @summary 新版代理商店获取代理IP国家
   * @request GET:/user_get_proxy_country_list_by_continent
   * @response `200` `UserGetProxyCountryListByContinentListData`
   */
  userGetProxyCountryListByContinentList = (
    query: UserGetProxyCountryListByContinentListParams,
    params: RequestParams = {},
  ) =>
    this.http.request<UserGetProxyCountryListByContinentListData, any>({
      path: `/user_get_proxy_country_list_by_continent`,
      method: "GET",
      query: query,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Proxy
   * @name UserGetProxyVendorJumpInfoList
   * @summary 获取代理厂商跳转信息
   * @request GET:/user_get_proxy_vendor_jump_info
   * @response `200` `UserGetProxyVendorJumpInfoListData`
   */
  userGetProxyVendorJumpInfoList = (
    query: UserGetProxyVendorJumpInfoListParams,
    params: RequestParams = {},
  ) =>
    this.http.request<UserGetProxyVendorJumpInfoListData, any>({
      path: `/user_get_proxy_vendor_jump_info`,
      method: "GET",
      query: query,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Proxy
   * @name UserReportProxyOutOfStockCreate
   * @summary 代理IP购买缺货上报
   * @request POST:/user_report_proxy_out_of_stock
   * @response `200` `UserReportProxyOutOfStockCreateData`
   */
  userReportProxyOutOfStockCreate = (
    data: UserReportProxyOutOfStockCreatePayload,
    params: RequestParams = {},
  ) =>
    this.http.request<UserReportProxyOutOfStockCreateData, any>({
      path: `/user_report_proxy_out_of_stock`,
      method: "POST",
      body: data,
      type: ContentType.Json,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Proxy
   * @name UserBatchMdfProxyModuleCheckCreate
   * @summary 批量修改代理IP检测结果
   * @request POST:/user_batch_mdf_proxy_module_check
   * @response `200` `UserBatchMdfProxyModuleCheckCreateData`
   */
  userBatchMdfProxyModuleCheckCreate = (
    data: UserBatchMdfProxyModuleCheckCreatePayload,
    params: RequestParams = {},
  ) =>
    this.http.request<UserBatchMdfProxyModuleCheckCreateData, any>({
      path: `/user_batch_mdf_proxy_module_check`,
      method: "POST",
      body: data,
      type: ContentType.Json,
      format: "json",
      ...params,
    });
}
