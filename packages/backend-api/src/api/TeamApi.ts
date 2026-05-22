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
  UserAddTeamNicknameCreateData,
  UserAddTeamNicknameCreatePayload,
  UserAddTeamWorkspaceNicknameCreateData,
  UserAddTeamWorkspaceNicknameCreatePayload,
  UserDelTeamInfoCreateData,
  UserDelTeamInfoCreatePayload,
  UserGetMemberInfoByWorkspaceListData,
  UserGetMemberInfoByWorkspaceListParams,
  UserGetRolePermissionsListData,
  UserGetRolePermissionsListParams,
  UserGetTeamPermissionsListData,
  UserGetTeamPermissionsListParams,
  UserGetTeamPermissionVerifyStatusListData,
  UserMdfTeamInfoV2CreateData,
  UserMdfTeamInfoV2CreatePayload,
  UserSendTeamPermissionVerifyCodeListData,
  UserSetTeamCostCenterViewerEditorAllowCreateData,
  UserSetTeamCostCenterViewerEditorAllowCreatePayload,
  UserUpdateTeamPermissionsCreateData,
  UserUpdateTeamPermissionsCreatePayload,
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
  userGetMemberInfoByWorkspaceList = (
    query: UserGetMemberInfoByWorkspaceListParams,
    params: RequestParams = {},
  ) =>
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
  userMdfTeamInfoV2Create = (
    data: UserMdfTeamInfoV2CreatePayload,
    params: RequestParams = {},
  ) =>
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
  userDelTeamInfoCreate = (
    data: UserDelTeamInfoCreatePayload,
    params: RequestParams = {},
  ) =>
    this.http.request<UserDelTeamInfoCreateData, any>({
      path: `/user_del_team_info`,
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
   * @name UserAddTeamNicknameCreate
   * @summary 修改备注名
   * @request POST:/user_add_team_nickname
   * @response `200` `UserAddTeamNicknameCreateData`
   */
  userAddTeamNicknameCreate = (
    data: UserAddTeamNicknameCreatePayload,
    params: RequestParams = {},
  ) =>
    this.http.request<UserAddTeamNicknameCreateData, any>({
      path: `/user_add_team_nickname`,
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
   * @name UserAddTeamWorkspaceNicknameCreate
   * @summary 修改成员空间备注名称
   * @request POST:/user_add_team_workspace_nickname
   * @response `200` `UserAddTeamWorkspaceNicknameCreateData`
   */
  userAddTeamWorkspaceNicknameCreate = (
    data: UserAddTeamWorkspaceNicknameCreatePayload,
    params: RequestParams = {},
  ) =>
    this.http.request<UserAddTeamWorkspaceNicknameCreateData, any>({
      path: `/user_add_team_workspace_nickname`,
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
   * @name UserGetTeamPermissionsList
   * @summary 团队成员权限信息获取
   * @request GET:/user_get_team_permissions
   * @response `200` `UserGetTeamPermissionsListData`
   */
  userGetTeamPermissionsList = (
    query: UserGetTeamPermissionsListParams,
    params: RequestParams = {},
  ) =>
    this.http.request<UserGetTeamPermissionsListData, any>({
      path: `/user_get_team_permissions`,
      method: "GET",
      query: query,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Team
   * @name UserUpdateTeamPermissionsCreate
   * @summary 修改团队成员权限信息
   * @request POST:/user_update_team_permissions
   * @response `200` `UserUpdateTeamPermissionsCreateData`
   */
  userUpdateTeamPermissionsCreate = (
    data: UserUpdateTeamPermissionsCreatePayload,
    params: RequestParams = {},
  ) =>
    this.http.request<UserUpdateTeamPermissionsCreateData, any>({
      path: `/user_update_team_permissions`,
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
   * @name UserGetRolePermissionsList
   * @summary 获取身份的默认权限列表
   * @request GET:/user_get_role_permissions
   * @response `200` `UserGetRolePermissionsListData`
   */
  userGetRolePermissionsList = (
    query: UserGetRolePermissionsListParams,
    params: RequestParams = {},
  ) =>
    this.http.request<UserGetRolePermissionsListData, any>({
      path: `/user_get_role_permissions`,
      method: "GET",
      query: query,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Team
   * @name UserGetTeamPermissionVerifyStatusList
   * @summary 团队敏感权限是否发送验证码
   * @request GET:/user_get_team_permission_verify_status
   * @response `200` `UserGetTeamPermissionVerifyStatusListData`
   */
  userGetTeamPermissionVerifyStatusList = (params: RequestParams = {}) =>
    this.http.request<UserGetTeamPermissionVerifyStatusListData, any>({
      path: `/user_get_team_permission_verify_status`,
      method: "GET",
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Team
   * @name UserSendTeamPermissionVerifyCodeList
   * @summary 开启敏感权限发送验证码
   * @request GET:/user_send_team_permission_verify_code
   * @response `200` `UserSendTeamPermissionVerifyCodeListData`
   */
  userSendTeamPermissionVerifyCodeList = (params: RequestParams = {}) =>
    this.http.request<UserSendTeamPermissionVerifyCodeListData, any>({
      path: `/user_send_team_permission_verify_code`,
      method: "GET",
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Team
   * @name UserSetTeamCostCenterViewerEditorAllowCreate
   * @summary 设置不允许查看者/编辑者拥有费用中心权限
   * @request POST:/user_set_team_cost_center_viewer_editor_allow
   * @response `200` `UserSetTeamCostCenterViewerEditorAllowCreateData`
   */
  userSetTeamCostCenterViewerEditorAllowCreate = (
    data: UserSetTeamCostCenterViewerEditorAllowCreatePayload,
    params: RequestParams = {},
  ) =>
    this.http.request<UserSetTeamCostCenterViewerEditorAllowCreateData, any>({
      path: `/user_set_team_cost_center_viewer_editor_allow`,
      method: "POST",
      body: data,
      type: ContentType.Json,
      format: "json",
      ...params,
    });
}
