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
  AdminRedirectAdminGetData,
  HealthHealthGetData,
} from "./data-contracts";
import { HttpClient, RequestParams } from "./http-client";

export class PublicApi<SecurityDataType = unknown> {
  http: HttpClient<SecurityDataType>;

  constructor(http: HttpClient<SecurityDataType>) {
    this.http = http;
  }

  /**
   * @description Return service status, environment, and configured base path.
   *
   * @tags public
   * @name HealthHealthGet
   * @summary Health check
   * @request GET:/health
   * @response `200` `HealthHealthGetData` Successful Response
   */
  healthHealthGet = (params: RequestParams = {}) =>
    this.http.request<HealthHealthGetData, any>({
      path: `/health`,
      method: "GET",
      format: "json",
      ...params,
    });
  /**
   * @description Redirect to the mounted admin UI root.
   *
   * @tags public
   * @name AdminRedirectAdminGet
   * @summary Admin entry
   * @request GET:/admin
   * @response `200` `AdminRedirectAdminGetData` Successful Response
   */
  adminRedirectAdminGet = (params: RequestParams = {}) =>
    this.http.request<AdminRedirectAdminGetData, any>({
      path: `/admin`,
      method: "GET",
      format: "json",
      ...params,
    });
}
