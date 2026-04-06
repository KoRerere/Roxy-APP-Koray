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
  UserBindRedeemCodeCreateData,
  UserBindRedeemCodeCreatePayload,
} from "./data-contracts";
import { ContentType, HttpClient, RequestParams } from "./http-client";

export class UserBindRedeemCodeApi<SecurityDataType = unknown> {
  http: HttpClient<SecurityDataType>;

  constructor(http: HttpClient<SecurityDataType>) {
    this.http = http;
  }

  /**
   * No description
   *
   * @name UserBindRedeemCodeCreate
   * @summary 兑换码预绑定用户
   * @request POST:/user_bind_redeem_code
   * @response `200` `UserBindRedeemCodeCreateData`
   */
  userBindRedeemCodeCreate = (
    data: UserBindRedeemCodeCreatePayload,
    params: RequestParams = {},
  ) =>
    this.http.request<UserBindRedeemCodeCreateData, any>({
      path: `/user_bind_redeem_code`,
      method: "POST",
      body: data,
      type: ContentType.Json,
      format: "json",
      ...params,
    });
}
