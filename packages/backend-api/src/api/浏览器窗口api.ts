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
  UserGetWindowInfoDetailListData,
  UserGetWindowInfoDetailListError,
  UserGetWindowInfoDetailListParams,
} from "./data-contracts";
import { HttpClient, RequestParams } from "./http-client";

export class 浏览器窗口api<SecurityDataType = unknown> {
  http: HttpClient<SecurityDataType>;

  constructor(http: HttpClient<SecurityDataType>) {
    this.http = http;
  }

  /**
 * @description 按窗口主键 `id` 或目录 `dirId` 获取单条窗口完整详情。 - `id` 与 `dirId` 至少传一个 - 返回字段与 `/user_get_window_info_v2` 单条结果一致 - 不触发打开次数 / 套餐额度校验（非打开场景） - 找不到窗口时返回参数错误：窗口/数据不存在，请刷新页面后重试
 *
 * @tags 浏览器窗口
 * @name UserGetWindowInfoDetailList
 * @summary 获取单条窗口详情
 * @request GET:/user_get_window_info_detail
 * @response `200` `UserGetWindowInfoDetailListData`
 * @response `400` `{
    code?: number,
  /** 如：id 和 dirId 至少传一个 / 窗口/数据不存在，请刷新页面后重试 *\/
    msg?: string,
    data?: string,

}`
 */
  userGetWindowInfoDetailList = (
    query: UserGetWindowInfoDetailListParams,
    params: RequestParams = {},
  ) =>
    this.http.request<
      UserGetWindowInfoDetailListData,
      UserGetWindowInfoDetailListError
    >({
      path: `/user_get_window_info_detail`,
      method: "GET",
      query: query,
      format: "json",
      ...params,
    });
}
