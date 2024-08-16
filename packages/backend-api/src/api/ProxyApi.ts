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

import {
  UserAddProxyModuleCreatePayload,
  UserCheckIpCreatePayload,
  UserDelProxyModuleCreatePayload,
  UserGetProxyModuleListParams,
  UserMdfProxyModuleCreatePayload,
  UserUnbindProxyModuleCreatePayload,
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
   */
  userGetProxyModuleList = (query: UserGetProxyModuleListParams, params: RequestParams = {}) =>
    this.http.request<
      {
        code: number;
        data: {
          total: number;
          rows: {
            id?: number;
            protocol?: string;
            country?: string;
            host?: string;
            port?: string;
            proxyUserName?: string;
            proxyPassword?: string;
            refreshUrl?: string;
            /** ip123.in/ip.json， str */
            checkChannel?: string;
            lastCountry?: string;
            checkStatus?: boolean;
            remark?: string;
            isBind?: boolean;
            bindCount?: number;
            bindList?: number[];
          }[];
        };
        msg: string;
      },
      any
    >({
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
   */
  userAddProxyModuleCreate = (data: UserAddProxyModuleCreatePayload, params: RequestParams = {}) =>
    this.http.request<object, any>({
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
   * @summary 修改单个代理
   * @request POST:/user_mdf_proxy_module
   */
  userMdfProxyModuleCreate = (data: UserMdfProxyModuleCreatePayload, params: RequestParams = {}) =>
    this.http.request<object, any>({
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
   * @name UserDelProxyModuleCreate
   * @summary 批量删除代理
   * @request POST:/user_del_proxy_module
   */
  userDelProxyModuleCreate = (data: UserDelProxyModuleCreatePayload, params: RequestParams = {}) =>
    this.http.request<object, any>({
      path: `/user_del_proxy_module`,
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
   * @name UserUnbindProxyModuleCreate
   * @summary  批量解绑代理
   * @request POST:/user_unbind_proxy_module
   */
  userUnbindProxyModuleCreate = (data: UserUnbindProxyModuleCreatePayload, params: RequestParams = {}) =>
    this.http.request<object, any>({
      path: `/user_unbind_proxy_module`,
      method: "POST",
      body: data,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Proxy
   * @name UserCheckIpCreate
   * @summary 检测单个静态IP
   * @request POST:/user_check_ip
   */
  userCheckIpCreate = (data: UserCheckIpCreatePayload, params: RequestParams = {}) =>
    this.http.request<
      {
        code: number;
        msg: string;
        data: {
          lastIp: string;
          lastCountry: string;
          lastCountryEnName: string;
          lastCountryCnName: string;
        };
      },
      any
    >({
      path: `/user_check_ip`,
      method: "POST",
      body: data,
      type: ContentType.Json,
      format: "json",
      ...params,
    });
}
