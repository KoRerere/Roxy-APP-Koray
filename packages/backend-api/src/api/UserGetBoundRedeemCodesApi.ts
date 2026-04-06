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

import { UserGetBoundRedeemCodesListData } from "./data-contracts";
import { HttpClient, RequestParams } from "./http-client";

export class UserGetBoundRedeemCodesApi<SecurityDataType = unknown> {
  http: HttpClient<SecurityDataType>;

  constructor(http: HttpClient<SecurityDataType>) {
    this.http = http;
  }

  /**
   * No description
   *
   * @name UserGetBoundRedeemCodesList
   * @summary 查询当前用户已预绑定兑换码
   * @request GET:/user_get_bound_redeem_codes
   * @response `200` `UserGetBoundRedeemCodesListData`
   */
  userGetBoundRedeemCodesList = (params: RequestParams = {}) =>
    this.http.request<UserGetBoundRedeemCodesListData, any>({
      path: `/user_get_bound_redeem_codes`,
      method: "GET",
      format: "json",
      ...params,
    });
}
