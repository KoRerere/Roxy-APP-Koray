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
  UserDelProjectInfoCreateData,
  UserDelProjectInfoCreatePayload,
  UserDelWorkspaceInfoCreateData,
  UserDelWorkspaceInfoCreatePayload,
  UserGetMemberInfoByProjectIdListData,
  UserGetMemberInfoByProjectIdListParams,
  UserGetProjectInfoByWorkspaceListData,
  UserGetProjectInfoByWorkspaceListParams,
  UserGetTopProjectInfoListData,
  UserGetWorkspaceListListData,
  UserInviteCreateData,
  UserInviteCreatePayload,
  UserLeaveWorkspaceListData,
  UserLeaveWorkspaceListParams,
  UserMdfProjectInfoCreateData,
  UserMdfProjectInfoCreatePayload,
  UserMdfWorkspaceInfoCreateData,
  UserMdfWorkspaceInfoCreatePayload,
  UserMdfWorkspaceTipInfoListData,
  UserShowInvitationLinkStatusCreateData,
  UserShowInvitationLinkStatusCreatePayload,
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
   * @response `200` `UserGetWorkspaceListListData`
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
   * @response `200` `UserAddWorkspaceInfoCreateData`
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
   * @response `200` `UserMdfWorkspaceInfoCreateData`
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
   * @name UserDelWorkspaceInfoCreate
   * @summary 删除工作空间
   * @request POST:/user_del_workspace_info
   * @response `200` `UserDelWorkspaceInfoCreateData`
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
   * @name UserLeaveWorkspaceList
   * @summary 离开空间
   * @request GET:/user_leave_workspace
   * @response `200` `UserLeaveWorkspaceListData`
   */
  userLeaveWorkspaceList = (query: UserLeaveWorkspaceListParams, params: RequestParams = {}) =>
    this.http.request<UserLeaveWorkspaceListData, any>({
      path: `/user_leave_workspace`,
      method: "GET",
      query: query,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Limit
   * @name UserMdfWorkspaceTipInfoList
   * @summary 修改首次工作空间点击提示
   * @request GET:/user_mdf_workspace_tip_info
   * @response `200` `UserMdfWorkspaceTipInfoListData`
   */
  userMdfWorkspaceTipInfoList = (params: RequestParams = {}) =>
    this.http.request<UserMdfWorkspaceTipInfoListData, any>({
      path: `/user_mdf_workspace_tip_info`,
      method: "GET",
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
   * @response `200` `UserAddProjectInfoCreateData`
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
   * @response `200` `UserMdfProjectInfoCreateData`
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
   * No description
   *
   * @tags Limit
   * @name UserGetProjectInfoByWorkspaceList
   * @summary 获取当前用户所拥有的项目及成员
   * @request GET:/user_get_project_info_by_workspace
   * @response `200` `UserGetProjectInfoByWorkspaceListData`
   */
  userGetProjectInfoByWorkspaceList = (query: UserGetProjectInfoByWorkspaceListParams, params: RequestParams = {}) =>
    this.http.request<UserGetProjectInfoByWorkspaceListData, any>({
      path: `/user_get_project_info_by_workspace`,
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
   * @response `200` `UserGetMemberInfoByProjectIdListData`
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
   * @response `200` `UserInviteCreateData`
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
  /**
   * No description
   *
   * @tags Limit
   * @name UserDelProjectInfoCreate
   * @summary 删除项目
   * @request POST:/user_del_project_info
   * @response `200` `UserDelProjectInfoCreateData`
   */
  userDelProjectInfoCreate = (data: UserDelProjectInfoCreatePayload, params: RequestParams = {}) =>
    this.http.request<UserDelProjectInfoCreateData, any>({
      path: `/user_del_project_info`,
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
   * @name UserGetTopProjectInfoList
   * @summary 获取当前用户所拥有的置顶项目信息
   * @request GET:/user_get_top_project_info
   * @response `200` `UserGetTopProjectInfoListData`
   */
  userGetTopProjectInfoList = (params: RequestParams = {}) =>
    this.http.request<UserGetTopProjectInfoListData, any>({
      path: `/user_get_top_project_info`,
      method: "GET",
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Limit
   * @name UserShowInvitationLinkStatusCreate
   * @summary 获取邀请链接状态
   * @request POST:/user_show_invitation_link_status
   * @response `200` `UserShowInvitationLinkStatusCreateData`
   */
  userShowInvitationLinkStatusCreate = (data: UserShowInvitationLinkStatusCreatePayload, params: RequestParams = {}) =>
    this.http.request<UserShowInvitationLinkStatusCreateData, any>({
      path: `/user_show_invitation_link_status`,
      method: "POST",
      body: data,
      type: ContentType.Json,
      format: "json",
      ...params,
    });
}
