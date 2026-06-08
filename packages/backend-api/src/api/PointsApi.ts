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
  UserBuyPointsSettlementCreateData,
  UserBuyPointsSettlementCreatePayload,
  UserCalculatePointsPriceListData,
  UserCalculatePointsPriceListParams,
  UserGetPointsRechargeRecordsListData,
  UserGetPointsRechargeRecordsListParams,
} from "./data-contracts";
import { ContentType, HttpClient, RequestParams } from "./http-client";

export class PointsApi<SecurityDataType = unknown> {
  http: HttpClient<SecurityDataType>;

  constructor(http: HttpClient<SecurityDataType>) {
    this.http = http;
  }

  /**
   * No description
   *
   * @tags points
   * @name UserCalculatePointsPriceList
   * @summary 获取积分充值价格
   * @request GET:/user_calculate_points_price
   * @response `200` `UserCalculatePointsPriceListData`
   */
  userCalculatePointsPriceList = (
    query: UserCalculatePointsPriceListParams,
    params: RequestParams = {},
  ) =>
    this.http.request<UserCalculatePointsPriceListData, any>({
      path: `/user_calculate_points_price`,
      method: "GET",
      query: query,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags points
   * @name UserBuyPointsSettlementCreate
   * @summary 用户积分充值结算
   * @request POST:/user_buy_points_settlement
   * @response `200` `UserBuyPointsSettlementCreateData`
   */
  userBuyPointsSettlementCreate = (
    data: UserBuyPointsSettlementCreatePayload,
    params: RequestParams = {},
  ) =>
    this.http.request<UserBuyPointsSettlementCreateData, any>({
      path: `/user_buy_points_settlement`,
      method: "POST",
      body: data,
      type: ContentType.Json,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags points
   * @name UserGetPointsRechargeRecordsList
   * @summary 获取用户积分充值记录
   * @request GET:/user_get_points_recharge_records
   * @response `200` `UserGetPointsRechargeRecordsListData`
   */
  userGetPointsRechargeRecordsList = (
    query: UserGetPointsRechargeRecordsListParams,
    params: RequestParams = {},
  ) =>
    this.http.request<UserGetPointsRechargeRecordsListData, any>({
      path: `/user_get_points_recharge_records`,
      method: "GET",
      query: query,
      format: "json",
      ...params,
    });
}
