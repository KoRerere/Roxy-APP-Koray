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
  UserMidAutumnClaimEggCreateData,
  UserMidAutumnClaimEggCreatePayload,
} from "./data-contracts";
import { ContentType, HttpClient, RequestParams } from "./http-client";

export class UserMidAutumnClaimEggApi<SecurityDataType = unknown> {
  http: HttpClient<SecurityDataType>;

  constructor(http: HttpClient<SecurityDataType>) {
    this.http = http;
  }

  /**
   * No description
   *
   * @name UserMidAutumnClaimEggCreate
   * @summary 中秋寻宝：领取彩蛋
   * @request POST:/user_mid_autumn_claim_egg
   * @response `200` `UserMidAutumnClaimEggCreateData`
   */
  userMidAutumnClaimEggCreate = (
    data: UserMidAutumnClaimEggCreatePayload,
    params: RequestParams = {},
  ) =>
    this.http.request<UserMidAutumnClaimEggCreateData, any>({
      path: `/user_mid_autumn_claim_egg`,
      method: "POST",
      body: data,
      type: ContentType.Json,
      format: "json",
      ...params,
    });
}
