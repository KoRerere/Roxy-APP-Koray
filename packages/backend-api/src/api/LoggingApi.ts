/* eslint-disable */
/* tslint:disable */
/*
 * ---------------------------------------------------------------
 * ## THIS FILE WAS GENERATED VIA SWAGGER-TYPESCRIPT-API        ##
 * ##                                                           ##
 * ## AUTHOR: acacode                                           ##
 * ## SOURCE: https://github.com/acacode/swagger-typescript-api ##
 * ---------------------------------------------------------------
 */

import { UserGetLoginLogListParams, UserGetOperateLogListParams } from "./data-contracts";
import { HttpClient, RequestParams } from "./http-client";

export class LoggingApi<SecurityDataType = unknown> {
  http: HttpClient<SecurityDataType>;

  constructor(http: HttpClient<SecurityDataType>) {
    this.http = http;
  }

  /**
   * No description
   *
   * @tags Logging
   * @name UserGetOperateLogList
   * @summary 操作日志->获取日志
   * @request GET:/user_get_operate_log
   */
  userGetOperateLogList = (query: UserGetOperateLogListParams, params: RequestParams = {}) =>
    this.http.request<
      {
        code: number;
        data: {
          total: number;
          rows: {
            id?: number;
            userName?: string;
            role?: string;
            operateType?: string;
            operateDetail?: string;
            operateTime?: string;
            status?: string;
            location?: string;
          }[];
        };
        msg: string;
      },
      any
    >({
      path: `/user_get_operate_log`,
      method: "GET",
      query: query,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Logging
   * @name UserGetLoginLogList
   * @summary 登录日志->获取日志
   * @request GET:/user_get_login_log
   */
  userGetLoginLogList = (query: UserGetLoginLogListParams, params: RequestParams = {}) =>
    this.http.request<
      {
        code: number;
        data: {
          total: number;
          rows: {
            id: number;
            userName: string;
            address: string;
            location: string;
            createTime: string;
          }[];
        };
        msg: string;
      },
      any
    >({
      path: `/user_get_login_log`,
      method: "GET",
      query: query,
      format: "json",
      ...params,
    });
}
