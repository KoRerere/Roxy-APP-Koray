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
  UserDelTeamInfoCreateData,
  UserDelTeamInfoCreatePayload,
  UserGetMemberInfoByWorkspaceListData,
  UserGetMemberInfoByWorkspaceListParams,
  UserMdfTeamInfoV2CreateData,
  UserMdfTeamInfoV2CreatePayload,
} from "./data-contracts";
import { ContentType, HttpClient, RequestParams } from "./http-client";

export class TeamApi<SecurityDataType = unknown> {
  http: HttpClient<SecurityDataType>;

  constructor(http: HttpClient<SecurityDataType>) {
    this.http = http;
  }

  /**
   * No description
   *
   * @tags Team
   * @name UserGetMemberInfoByWorkspaceList
   * @summary 团队信息列表
   * @request GET:/user_get_member_info_by_workspace
   * @response `200` `UserGetMemberInfoByWorkspaceListData`
   */
  userGetMemberInfoByWorkspaceList = (query: UserGetMemberInfoByWorkspaceListParams, params: RequestParams = {}) =>
    this.http.request<UserGetMemberInfoByWorkspaceListData, any>({
      path: `/user_get_member_info_by_workspace`,
      method: "GET",
      query: query,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Team
   * @name UserMdfTeamInfoV2Create
   * @summary 修改团队信息
   * @request POST:/user_mdf_team_info_v2
   * @response `200` `UserMdfTeamInfoV2CreateData`
   */
  userMdfTeamInfoV2Create = (data: UserMdfTeamInfoV2CreatePayload, params: RequestParams = {}) =>
    this.http.request<UserMdfTeamInfoV2CreateData, any>({
      path: `/user_mdf_team_info_v2`,
      method: "POST",
      body: data,
      type: ContentType.Json,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Team
   * @name UserDelTeamInfoCreate
   * @summary 删除团队信息
   * @request POST:/user_del_team_info
   * @response `200` `UserDelTeamInfoCreateData`
   */
  userDelTeamInfoCreate = (data: UserDelTeamInfoCreatePayload, params: RequestParams = {}) =>
    this.http.request<UserDelTeamInfoCreateData, any>({
      path: `/user_del_team_info`,
      method: "POST",
      body: data,
      type: ContentType.Json,
      format: "json",
      ...params,
    });
}
