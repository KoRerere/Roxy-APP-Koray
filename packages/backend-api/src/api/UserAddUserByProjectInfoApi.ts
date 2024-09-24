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

import { UserAddUserByProjectInfoCreateData, UserAddUserByProjectInfoCreatePayload } from "./data-contracts";
import { ContentType, HttpClient, RequestParams } from "./http-client";

export class UserAddUserByProjectInfoApi<SecurityDataType = unknown> {
  http: HttpClient<SecurityDataType>;

  constructor(http: HttpClient<SecurityDataType>) {
    this.http = http;
  }

  /**
   * No description
   *
   * @name UserAddUserByProjectInfoCreate
   * @summary 绑定用户关联的项目
   * @request POST:/user_add_user_by_project_info
   * @response `200` `UserAddUserByProjectInfoCreateData`
   */
  userAddUserByProjectInfoCreate = (data: UserAddUserByProjectInfoCreatePayload, params: RequestParams = {}) =>
    this.http.request<UserAddUserByProjectInfoCreateData, any>({
      path: `/user_add_user_by_project_info`,
      method: "POST",
      body: data,
      type: ContentType.Json,
      format: "json",
      ...params,
    });
}
