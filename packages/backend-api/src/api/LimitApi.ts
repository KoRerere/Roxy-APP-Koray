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
  UserAddProjectInfoCreateData,
  UserAddProjectInfoCreatePayload,
  UserAddUserByProjectInfoCreateData,
  UserAddUserByProjectInfoCreatePayload,
  UserAddWorkspaceInfoCreateData,
  UserAddWorkspaceInfoCreatePayload,
  UserDelWorkspaceInfoCreateData,
  UserDelWorkspaceInfoCreatePayload,
  UserGetMemberInfoByProjectIdListData,
  UserGetMemberInfoByProjectIdListParams,
  UserGetMemberInfoByWorkspaceListData,
  UserGetMemberInfoByWorkspaceListParams,
  UserGetProjectInfoByWorkspaceListData,
  UserGetWorkspaceListListData,
  UserInviteCreateData,
  UserInviteCreatePayload,
  UserMdfProjectInfoCreateData,
  UserMdfProjectInfoCreatePayload,
  UserMdfWorkspaceInfoCreateData,
  UserMdfWorkspaceInfoCreatePayload,
} from "./data-contracts";
import { ContentType, HttpClient, RequestParams } from "./http-client";

export class LimitApi<SecurityDataType = unknown> {
  http: HttpClient<SecurityDataType>;

  constructor(http: HttpClient<SecurityDataType>) {
    this.http = http;
  }

  /**
   * @description role 权限： Viewer(查看者,枚举：0) Editor(编辑者,枚举：1) Manager(管理者,枚举：2) Owner(拥有者,枚举：3)
   *
   * @tags Limit
   * @name UserGetWorkspaceListList
   * @summary 获取工作空间列表
   * @request GET:/user_get_workspace_list
   * @response `200` `UserGetWorkspaceListListData` 成功
   */
  userGetWorkspaceListList = (params: RequestParams = {}) =>
    this.http.request<UserGetWorkspaceListListData, any>({
      path: `/user_get_workspace_list`,
      method: "GET",
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Limit
   * @name UserAddWorkspaceInfoCreate
   * @summary 新增工作空间
   * @request POST:/user_add_workspace_info
   * @response `200` `UserAddWorkspaceInfoCreateData` 成功
   */
  userAddWorkspaceInfoCreate = (data: UserAddWorkspaceInfoCreatePayload, params: RequestParams = {}) =>
    this.http.request<UserAddWorkspaceInfoCreateData, any>({
      path: `/user_add_workspace_info`,
      method: "POST",
      body: data,
      type: ContentType.Json,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Limit
   * @name UserMdfWorkspaceInfoCreate
   * @summary 修改工作空间
   * @request POST:/user_mdf_workspace_info
   * @response `200` `UserMdfWorkspaceInfoCreateData` 成功
   */
  userMdfWorkspaceInfoCreate = (data: UserMdfWorkspaceInfoCreatePayload, params: RequestParams = {}) =>
    this.http.request<UserMdfWorkspaceInfoCreateData, any>({
      path: `/user_mdf_workspace_info`,
      method: "POST",
      body: data,
      type: ContentType.Json,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Limit
   * @name UserAddProjectInfoCreate
   * @summary 新增项目
   * @request POST:/user_add_project_info
   * @response `200` `UserAddProjectInfoCreateData` 成功
   */
  userAddProjectInfoCreate = (data: UserAddProjectInfoCreatePayload, params: RequestParams = {}) =>
    this.http.request<UserAddProjectInfoCreateData, any>({
      path: `/user_add_project_info`,
      method: "POST",
      body: data,
      type: ContentType.Json,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Limit
   * @name UserMdfProjectInfoCreate
   * @summary 修改项目
   * @request POST:/user_mdf_project_info
   * @response `200` `UserMdfProjectInfoCreateData` 成功
   */
  userMdfProjectInfoCreate = (data: UserMdfProjectInfoCreatePayload, params: RequestParams = {}) =>
    this.http.request<UserMdfProjectInfoCreateData, any>({
      path: `/user_mdf_project_info`,
      method: "POST",
      body: data,
      type: ContentType.Json,
      format: "json",
      ...params,
    });
  /**
   * @description role 权限： Viewer(查看者,枚举：0)  Editor(编辑者,枚举：1)  Manager(管理者,枚举：2) Owner(拥有者,枚举：3)
   *
   * @tags Limit
   * @name UserGetProjectInfoByWorkspaceList
   * @summary 获取当前用户所拥有的项目及成员
   * @request GET:/user_get_project_info_by_workspace
   * @response `200` `UserGetProjectInfoByWorkspaceListData` 成功
   */
  userGetProjectInfoByWorkspaceList = (params: RequestParams = {}) =>
    this.http.request<UserGetProjectInfoByWorkspaceListData, any>({
      path: `/user_get_project_info_by_workspace`,
      method: "GET",
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Limit
   * @name UserDelWorkspaceInfoCreate
   * @summary 删除工作空间
   * @request POST:/user_del_workspace_info
   * @response `200` `UserDelWorkspaceInfoCreateData` 成功
   */
  userDelWorkspaceInfoCreate = (data: UserDelWorkspaceInfoCreatePayload, params: RequestParams = {}) =>
    this.http.request<UserDelWorkspaceInfoCreateData, any>({
      path: `/user_del_workspace_info`,
      method: "POST",
      body: data,
      type: ContentType.Json,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Limit
   * @name UserGetMemberInfoByWorkspaceList
   * @summary 获取成员所在的项目(团队管理列表)
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
   * @tags Limit
   * @name UserGetMemberInfoByProjectIdList
   * @summary 根据项目ID获取成员
   * @request GET:/user_get_member_info_by_project_id
   * @response `200` `UserGetMemberInfoByProjectIdListData` 成功
   */
  userGetMemberInfoByProjectIdList = (query: UserGetMemberInfoByProjectIdListParams, params: RequestParams = {}) =>
    this.http.request<UserGetMemberInfoByProjectIdListData, any>({
      path: `/user_get_member_info_by_project_id`,
      method: "GET",
      query: query,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Limit
   * @name UserInviteCreate
   * @summary 邀请用户
   * @request POST:/user_invite
   * @response `200` `UserInviteCreateData` 成功
   */
  userInviteCreate = (data: UserInviteCreatePayload, params: RequestParams = {}) =>
    this.http.request<UserInviteCreateData, any>({
      path: `/user_invite`,
      method: "POST",
      body: data,
      type: ContentType.Json,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Limit
   * @name UserAddUserByProjectInfoCreate
   * @summary 绑定用户关联的项目
   * @request POST:/user_add_user_by_project_info
   * @response `200` `UserAddUserByProjectInfoCreateData` 成功
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
