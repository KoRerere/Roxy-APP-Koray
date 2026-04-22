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
  GetCountryConfigListData,
  GetCountryConfigListParams,
} from "./data-contracts";
import { HttpClient, RequestParams } from "./http-client";

export class GetCountryConfigApi<SecurityDataType = unknown> {
  http: HttpClient<SecurityDataType>;

  constructor(http: HttpClient<SecurityDataType>) {
    this.http = http;
  }

  /**
   * No description
   *
   * @name GetCountryConfigList
   * @summary 获取V2国家配置
   * @request GET:/get_country_config
   * @response `200` `GetCountryConfigListData`
   */
  getCountryConfigList = (
    query: GetCountryConfigListParams,
    params: RequestParams = {},
  ) =>
    this.http.request<GetCountryConfigListData, any>({
      path: `/get_country_config`,
      method: "GET",
      query: query,
      format: "json",
      ...params,
    });
}
