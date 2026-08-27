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
  UserAddProxyModuleV2CreateData,
  UserAddProxyModuleV2CreatePayload,
  UserBatchCheckProxyImportCreateData,
  UserBatchCheckProxyImportCreatePayload,
  UserBatchMdfProxyModuleCheckCreateData,
  UserBatchMdfProxyModuleCheckCreatePayload,
  UserCheckProxyBindRiskCreateData,
  UserCheckProxyBindRiskCreatePayload,
  UserCheckProxyCreateData,
  UserCheckProxyCreatePayload,
  UserCheckWindowProxyStatusCreateData,
  UserCheckWindowProxyStatusCreatePayload,
  UserDelProxyModuleV2CreateData,
  UserDelProxyModuleV2CreatePayload,
  UserExportProxyDeviceInfoCreateData,
  UserExportProxyDeviceInfoCreatePayload,
  UserGetPromotionRedeemCodeListListData,
  UserGetPromotionRedeemCodeListListParams,
  UserGetProxyAllCountriesListData,
  UserGetProxyAllCountriesListParams,
  UserGetProxyBandwidthUpgradePriceListListData,
  UserGetProxyBandwidthUpgradePriceListListParams,
  UserGetProxyBusinessSceneListListData,
  UserGetProxyBusinessSceneListListParams,
  UserGetProxyBusinessUseListListData,
  UserGetProxyCountryListByBusinessSceneListData,
  UserGetProxyCountryListByBusinessSceneListParams,
  UserGetProxyCountryListByContinentListData,
  UserGetProxyCountryListByContinentListParams,
  UserGetProxyCountryPriceListListData,
  UserGetProxyCountryPriceListListParams,
  UserGetProxyDetailMergedListData,
  UserGetProxyDetailMergedListParams,
  UserGetProxyDeviceBoundAccountsListData,
  UserGetProxyDeviceBoundAccountsListParams,
  UserGetProxyDeviceDetailListData,
  UserGetProxyDeviceDetailListParams,
  UserGetProxyDurationDiscountsByDaysListData,
  UserGetProxyListMergedListData,
  UserGetProxyListMergedListParams,
  UserGetProxyModuleListData,
  UserGetProxyModuleListParams,
  UserGetProxyOperateRecordListCreateData,
  UserGetProxyOperateRecordListCreatePayload,
  UserGetProxyProviderListListData,
  UserGetProxyProvidersByBusinessSceneCountryListData,
  UserGetProxyProvidersByBusinessSceneCountryListParams,
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
  UserGetProxyRenewPriceListListData,
  UserGetProxyStoreListListData,
  UserGetProxyTableRowsListData,
  UserGetProxyTableSortOrderListData,
  UserGetProxyVendorJumpInfoListData,
  UserGetProxyVendorJumpInfoListParams,
  UserGetProxyVendorListListData,
  UserGetRandomAvailableProxyMergedListData,
  UserGetTimezoneByCoordinatesInfoListData,
  UserGetTimezoneByCoordinatesInfoListParams,
  UserGetTimezoneByIpListData,
  UserGetTimezoneByIpListParams,
  UserGetUserBuyProxyListListData,
  UserGetUserBuyProxyListListParams,
  UserMdfProxyBindWindowCreateData,
  UserMdfProxyBindWindowCreatePayload,
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
  UserRenewDeviceProxySettlementCreateData,
  UserRenewDeviceProxySettlementCreatePayload,
  UserReportProxyOutOfStockCreateData,
  UserReportProxyOutOfStockCreatePayload,
  UserSaveProxyTableSortOrderCreateData,
  UserSaveProxyTableSortOrderCreatePayload,
  UserSetProxyAutoRenewalCreateData,
  UserSetProxyAutoRenewalCreatePayload,
  UserUpdateProxyTableRowsCreateData,
  UserUpdateProxyTableRowsCreatePayload,
  UserUpgradeProxyBandwidthSettlementCreateData,
  UserUpgradeProxyBandwidthSettlementCreatePayload,
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
  /**
   * No description
   *
   * @tags Proxy
   * @name UserGetProxyDetailMergedList
   * @summary 获取代理详情
   * @request GET:/user_get_proxy_detail_merged
   * @response `200` `UserGetProxyDetailMergedListData`
   */
  userGetProxyDetailMergedList = (
    query: UserGetProxyDetailMergedListParams,
    params: RequestParams = {},
  ) =>
    this.http.request<UserGetProxyDetailMergedListData, any>({
      path: `/user_get_proxy_detail_merged`,
      method: "GET",
      query: query,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Proxy
   * @name UserGetProxyCountryListByBusinessSceneList
   * @summary 根据用途获取代理IP国家信息
   * @request GET:/user_get_proxy_country_list_by_business_scene
   * @response `200` `UserGetProxyCountryListByBusinessSceneListData`
   */
  userGetProxyCountryListByBusinessSceneList = (
    query: UserGetProxyCountryListByBusinessSceneListParams,
    params: RequestParams = {},
  ) =>
    this.http.request<UserGetProxyCountryListByBusinessSceneListData, any>({
      path: `/user_get_proxy_country_list_by_business_scene`,
      method: "GET",
      query: query,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Proxy
   * @name UserGetProxyProvidersByBusinessSceneCountryList
   * @summary 根据用途跟国家获取代理类型信息
   * @request GET:/user_get_proxy_providers_by_business_scene_country
   * @response `200` `UserGetProxyProvidersByBusinessSceneCountryListData`
   */
  userGetProxyProvidersByBusinessSceneCountryList = (
    query: UserGetProxyProvidersByBusinessSceneCountryListParams,
    params: RequestParams = {},
  ) =>
    this.http.request<UserGetProxyProvidersByBusinessSceneCountryListData, any>(
      {
        path: `/user_get_proxy_providers_by_business_scene_country`,
        method: "GET",
        query: query,
        format: "json",
        ...params,
      },
    );
  /**
   * No description
   *
   * @tags Proxy
   * @name UserUpgradeProxyBandwidthSettlementCreate
   * @summary 代理IP带宽升级
   * @request POST:/user_upgrade_proxy_bandwidth_settlement
   * @response `200` `UserUpgradeProxyBandwidthSettlementCreateData`
   */
  userUpgradeProxyBandwidthSettlementCreate = (
    data: UserUpgradeProxyBandwidthSettlementCreatePayload,
    params: RequestParams = {},
  ) =>
    this.http.request<UserUpgradeProxyBandwidthSettlementCreateData, any>({
      path: `/user_upgrade_proxy_bandwidth_settlement`,
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
   * @name UserMdfProxyBindWindowCreate
   * @summary 修改代理绑定的窗口
   * @request POST:/user_mdf_proxy_bind_window
   * @response `200` `UserMdfProxyBindWindowCreateData`
   */
  userMdfProxyBindWindowCreate = (
    data: UserMdfProxyBindWindowCreatePayload,
    params: RequestParams = {},
  ) =>
    this.http.request<UserMdfProxyBindWindowCreateData, any>({
      path: `/user_mdf_proxy_bind_window`,
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
   * @name UserGetProxyBandwidthUpgradePriceListList
   * @summary 获取用户升级代理带宽价格
   * @request GET:/user_get_proxy_bandwidth_upgrade_price_list
   * @response `200` `UserGetProxyBandwidthUpgradePriceListListData`
   */
  userGetProxyBandwidthUpgradePriceListList = (
    query: UserGetProxyBandwidthUpgradePriceListListParams,
    params: RequestParams = {},
  ) =>
    this.http.request<UserGetProxyBandwidthUpgradePriceListListData, any>({
      path: `/user_get_proxy_bandwidth_upgrade_price_list`,
      method: "GET",
      query: query,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Proxy
   * @name UserRenewDeviceProxySettlementCreate
   * @summary 代理设备续费
   * @request POST:/user_renew_device_proxy_settlement
   * @response `200` `UserRenewDeviceProxySettlementCreateData`
   */
  userRenewDeviceProxySettlementCreate = (
    data: UserRenewDeviceProxySettlementCreatePayload,
    params: RequestParams = {},
  ) =>
    this.http.request<UserRenewDeviceProxySettlementCreateData, any>({
      path: `/user_renew_device_proxy_settlement`,
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
   * @name UserGetProxyRenewPriceListList
   * @summary 获取设备价格列表信息
   * @request GET:/user_get_proxy_renew_price_list
   * @response `200` `UserGetProxyRenewPriceListListData`
   */
  userGetProxyRenewPriceListList = (params: RequestParams = {}) =>
    this.http.request<UserGetProxyRenewPriceListListData, any>({
      path: `/user_get_proxy_renew_price_list`,
      method: "GET",
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Proxy
   * @name UserExportProxyDeviceInfoCreate
   * @summary 代理设备导出记录
   * @request POST:/user_export_proxy_device_info
   * @response `200` `UserExportProxyDeviceInfoCreateData`
   */
  userExportProxyDeviceInfoCreate = (
    data: UserExportProxyDeviceInfoCreatePayload,
    params: RequestParams = {},
  ) =>
    this.http.request<UserExportProxyDeviceInfoCreateData, any>({
      path: `/user_export_proxy_device_info`,
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
   * @name UserGetProxyOperateRecordListCreate
   * @summary 获取设备操作记录
   * @request POST:/user_get_proxy_operate_record_list
   * @response `200` `UserGetProxyOperateRecordListCreateData`
   */
  userGetProxyOperateRecordListCreate = (
    data: UserGetProxyOperateRecordListCreatePayload,
    params: RequestParams = {},
  ) =>
    this.http.request<UserGetProxyOperateRecordListCreateData, any>({
      path: `/user_get_proxy_operate_record_list`,
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
   * @name UserCheckProxyBindRiskCreate
   * @summary 设备检测
   * @request POST:/user_check_proxy_bind_risk
   * @response `200` `UserCheckProxyBindRiskCreateData`
   */
  userCheckProxyBindRiskCreate = (
    data: UserCheckProxyBindRiskCreatePayload,
    params: RequestParams = {},
  ) =>
    this.http.request<UserCheckProxyBindRiskCreateData, any>({
      path: `/user_check_proxy_bind_risk`,
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
   * @name UserGetProxyDeviceDetailList
   * @summary 获取代理IP详情信息
   * @request GET:/user_get_proxy_device_detail
   * @response `200` `UserGetProxyDeviceDetailListData`
   */
  userGetProxyDeviceDetailList = (
    query: UserGetProxyDeviceDetailListParams,
    params: RequestParams = {},
  ) =>
    this.http.request<UserGetProxyDeviceDetailListData, any>({
      path: `/user_get_proxy_device_detail`,
      method: "GET",
      query: query,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Proxy
   * @name UserBatchCheckProxyImportCreate
   * @summary 批量检测 半年内是否导入 IP
   * @request POST:/user_batch_check_proxy_import
   * @response `200` `UserBatchCheckProxyImportCreateData`
   */
  userBatchCheckProxyImportCreate = (
    data: UserBatchCheckProxyImportCreatePayload,
    params: RequestParams = {},
  ) =>
    this.http.request<UserBatchCheckProxyImportCreateData, any>({
      path: `/user_batch_check_proxy_import`,
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
   * @name UserGetProxyDeviceBoundAccountsList
   * @summary  获取代理设备绑定账号分页列表
   * @request GET:/user_get_proxy_device_bound_accounts
   * @response `200` `UserGetProxyDeviceBoundAccountsListData`
   */
  userGetProxyDeviceBoundAccountsList = (
    query: UserGetProxyDeviceBoundAccountsListParams,
    params: RequestParams = {},
  ) =>
    this.http.request<UserGetProxyDeviceBoundAccountsListData, any>({
      path: `/user_get_proxy_device_bound_accounts`,
      method: "GET",
      query: query,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Proxy
   * @name UserAddProxyModuleV2Create
   * @summary 导入代理（电商模式）
   * @request POST:/user_add_proxy_module_v2
   * @response `200` `UserAddProxyModuleV2CreateData`
   */
  userAddProxyModuleV2Create = (
    data: UserAddProxyModuleV2CreatePayload,
    params: RequestParams = {},
  ) =>
    this.http.request<UserAddProxyModuleV2CreateData, any>({
      path: `/user_add_proxy_module_v2`,
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
   * @name UserGetRandomAvailableProxyMergedList
   * @summary 随机获取一条可用代理
   * @request GET:/user_get_random_available_proxy_merged
   * @response `200` `UserGetRandomAvailableProxyMergedListData`
   */
  userGetRandomAvailableProxyMergedList = (params: RequestParams = {}) =>
    this.http.request<UserGetRandomAvailableProxyMergedListData, any>({
      path: `/user_get_random_available_proxy_merged`,
      method: "GET",
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Proxy
   * @name UserGetProxyDurationDiscountsByDaysList
   * @summary 获取代理时长续费折扣
   * @request GET:/user_get_proxy_duration_discounts_by_days
   * @response `200` `UserGetProxyDurationDiscountsByDaysListData`
   */
  userGetProxyDurationDiscountsByDaysList = (params: RequestParams = {}) =>
    this.http.request<UserGetProxyDurationDiscountsByDaysListData, any>({
      path: `/user_get_proxy_duration_discounts_by_days`,
      method: "GET",
      format: "json",
      ...params,
    });
}
