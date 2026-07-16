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
  AddSystemTodoListData,
  AddSystemTodoListParams,
  CheckIpDownloadLimitListData,
  GetCompanyPartnerDetailListData,
  GetCompanyPartnerDetailListParams,
  GetCompanyPartnerListListData,
  GetCompanyPartnerListListParams,
  GetEasterEggRemainingListData,
  GetPromotionLinkDiscountListData,
  GetPromotionLinkDiscountListParams,
  GetVersionListListData,
  GetVersionListListParams,
  UpdateAuthStatisticsCreateData,
  UpdateAuthStatisticsCreatePayload,
} from "./data-contracts";
import { ContentType, HttpClient, RequestParams } from "./http-client";

export class AppStatisticsApi<SecurityDataType = unknown> {
  http: HttpClient<SecurityDataType>;

  constructor(http: HttpClient<SecurityDataType>) {
    this.http = http;
  }

  /**
   * No description
   *
   * @name CheckIpDownloadLimitList
   * @summary 查询官网APP下载限制
   * @request GET:/app_statistics/check_ip_download_limit
   * @response `200` `CheckIpDownloadLimitListData`
   */
  checkIpDownloadLimitList = (params: RequestParams = {}) =>
    this.http.request<CheckIpDownloadLimitListData, any>({
      path: `/app_statistics/check_ip_download_limit`,
      method: "GET",
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @name GetVersionListList
   * @summary 官网获取APP版本信息
   * @request GET:/app_statistics/get_version_list
   * @response `200` `GetVersionListListData`
   */
  getVersionListList = (
    query: GetVersionListListParams,
    params: RequestParams = {},
  ) =>
    this.http.request<GetVersionListListData, any>({
      path: `/app_statistics/get_version_list`,
      method: "GET",
      query: query,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @name GetPromotionLinkDiscountList
   * @summary 官网-查询邀请链接折扣
   * @request GET:/app_statistics/get_promotion_link_discount
   * @response `200` `GetPromotionLinkDiscountListData`
   */
  getPromotionLinkDiscountList = (
    query: GetPromotionLinkDiscountListParams,
    params: RequestParams = {},
  ) =>
    this.http.request<GetPromotionLinkDiscountListData, any>({
      path: `/app_statistics/get_promotion_link_discount`,
      method: "GET",
      query: query,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @name AddSystemTodoList
   * @summary 配额不足新增代办
   * @request GET:/app_statistics/add_system_todo
   * @response `200` `AddSystemTodoListData`
   */
  addSystemTodoList = (
    query: AddSystemTodoListParams,
    params: RequestParams = {},
  ) =>
    this.http.request<AddSystemTodoListData, any>({
      path: `/app_statistics/add_system_todo`,
      method: "GET",
      query: query,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @name UpdateAuthStatisticsCreate
   * @summary 学生认证/美国军人统计
   * @request POST:/app_statistics/update_auth_statistics
   * @response `200` `UpdateAuthStatisticsCreateData`
   */
  updateAuthStatisticsCreate = (
    data: UpdateAuthStatisticsCreatePayload,
    params: RequestParams = {},
  ) =>
    this.http.request<UpdateAuthStatisticsCreateData, any>({
      path: `/app_statistics/update_auth_statistics`,
      method: "POST",
      body: data,
      type: ContentType.Json,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @name GetEasterEggRemainingList
   * @summary 彩蛋剩余数量
   * @request GET:/app_statistics/get_easter_egg_remaining
   * @response `200` `GetEasterEggRemainingListData`
   */
  getEasterEggRemainingList = (params: RequestParams = {}) =>
    this.http.request<GetEasterEggRemainingListData, any>({
      path: `/app_statistics/get_easter_egg_remaining`,
      method: "GET",
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @name GetCompanyPartnerListList
   * @summary 官网获取合作伙伴列表
   * @request GET:/app_statistics/get_company_partner_list
   * @response `200` `GetCompanyPartnerListListData`
   */
  getCompanyPartnerListList = (
    query: GetCompanyPartnerListListParams,
    params: RequestParams = {},
  ) =>
    this.http.request<GetCompanyPartnerListListData, any>({
      path: `/app_statistics/get_company_partner_list`,
      method: "GET",
      query: query,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @name GetCompanyPartnerDetailList
   * @summary 官网获取合作伙伴详情
   * @request GET:/app_statistics/get_company_partner_detail
   * @response `200` `GetCompanyPartnerDetailListData`
   */
  getCompanyPartnerDetailList = (
    query: GetCompanyPartnerDetailListParams,
    params: RequestParams = {},
  ) =>
    this.http.request<GetCompanyPartnerDetailListData, any>({
      path: `/app_statistics/get_company_partner_detail`,
      method: "GET",
      query: query,
      format: "json",
      ...params,
    });
}
