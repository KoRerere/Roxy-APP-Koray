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
  HealthHealthGetData,
  HealthHealthGetError,
  HealthHealthGetParams,
} from "./data-contracts";
import { HttpClient, RequestParams } from "./http-client";

export class PublicApi<SecurityDataType = unknown> {
  http: HttpClient<SecurityDataType>;

  constructor(http: HttpClient<SecurityDataType>) {
    this.http = http;
  }

  /**
   * @description Return service status, environment, and configured base path. Use `?deep=1` to probe MySQL/Redis and report cache status; returns HTTP 503 when hard dependencies are unavailable.
   *
   * @tags public
   * @name HealthHealthGet
   * @summary Health check
   * @request GET:/health
   * @response `200` `HealthHealthGetData` Successful Response
   * @response `422` `ApiErrorResponse` Unprocessable Entity
   * @response `503` `ApiErrorResponse` Service Unavailable
   */
  healthHealthGet = (
    query: HealthHealthGetParams,
    params: RequestParams = {},
  ) =>
    this.http.request<HealthHealthGetData, HealthHealthGetError>({
      path: `/health`,
      method: "GET",
      query: query,
      format: "json",
      ...params,
    });
}
