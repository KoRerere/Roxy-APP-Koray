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
  UserAddUserListCreateData,
  UserAddUserListCreatePayload,
  UserDelTeamInfoCreateData,
  UserDelTeamInfoCreatePayload,
  UserDelUserListCreateData,
  UserDelUserListCreatePayload,
  UserGetMemberInfoByWorkspaceListData,
  UserGetMemberInfoByWorkspaceListParams,
  UserGetUserListListData,
  UserGetUserListListParams,
  UserMdfTeamInfoCreateData,
  UserMdfTeamInfoCreatePayload,
  UserMdfUserListCreateData,
  UserMdfUserListCreatePayload,
  UserSelectGroupListData,
  UserSelectManagerListData,
  UserSelectStaffListData,
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
   * @name UserMdfTeamInfoCreate
   * @summary 修改团队信息(新团队管理修改)
   * @request POST:/user_mdf_team_info
   * @response `200` `UserMdfTeamInfoCreateData` 成功
   */
  userMdfTeamInfoCreate = (data: UserMdfTeamInfoCreatePayload, params: RequestParams = {}) =>
    this.http.request<UserMdfTeamInfoCreateData, any>({
      path: `/user_mdf_team_info`,
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
   * @name UserGetUserListList
   * @summary 获取用户列表
   * @request GET:/user_get_user_list
   * @response `200` `UserGetUserListListData`
   */
  userGetUserListList = (query: UserGetUserListListParams, params: RequestParams = {}) =>
    this.http.request<UserGetUserListListData, any>({
      path: `/user_get_user_list`,
      method: "GET",
      query: query,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Team
   * @name UserSelectStaffList
   * @summary 添加员工->选择员工列表
   * @request GET:/user_select_staff
   * @response `200` `UserSelectStaffListData`
   */
  userSelectStaffList = (params: RequestParams = {}) =>
    this.http.request<UserSelectStaffListData, any>({
      path: `/user_select_staff`,
      method: "GET",
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Team
   * @name UserSelectManagerList
   * @summary 添加员工->选择所属经理列表
   * @request GET:/user_select_manager
   * @response `200` `UserSelectManagerListData`
   */
  userSelectManagerList = (params: RequestParams = {}) =>
    this.http.request<UserSelectManagerListData, any>({
      path: `/user_select_manager`,
      method: "GET",
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Team
   * @name UserSelectGroupList
   * @summary 添加员工->选择授权分组列表
   * @request GET:/user_select_group
   * @response `200` `UserSelectGroupListData`
   */
  userSelectGroupList = (params: RequestParams = {}) =>
    this.http.request<UserSelectGroupListData, any>({
      path: `/user_select_group`,
      method: "GET",
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Team
   * @name UserAddUserListCreate
   * @summary 添加员工
   * @request POST:/user_add_user_list
   * @response `200` `UserAddUserListCreateData`
   */
  userAddUserListCreate = (data: UserAddUserListCreatePayload, params: RequestParams = {}) =>
    this.http.request<UserAddUserListCreateData, any>({
      path: `/user_add_user_list`,
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
   * @name UserMdfUserListCreate
   * @summary 修改员工
   * @request POST:/user_mdf_user_list
   * @response `200` `UserMdfUserListCreateData`
   */
  userMdfUserListCreate = (data: UserMdfUserListCreatePayload, params: RequestParams = {}) =>
    this.http.request<UserMdfUserListCreateData, any>({
      path: `/user_mdf_user_list`,
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
   * @name UserDelUserListCreate
   * @summary 员工管理->删除员工 Copy
   * @request POST:/user_del_user_list
   * @response `200` `UserDelUserListCreateData`
   */
  userDelUserListCreate = (data: UserDelUserListCreatePayload, params: RequestParams = {}) =>
    this.http.request<UserDelUserListCreateData, any>({
      path: `/user_del_user_list`,
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
   * @name UserGetMemberInfoByWorkspaceList
   * @summary 获取成员所在的项目(新团队管理列表)
   * @request GET:/user_get_member_info_by_workspace
   * @response `200` `UserGetMemberInfoByWorkspaceListData` 成功
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
   * @name UserDelTeamInfoCreate
   * @summary 删除团队信息(新团队管理删除)
   * @request POST:/user_del_team_info
   * @response `200` `UserDelTeamInfoCreateData` 成功
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
