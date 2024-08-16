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
  UserAddUserListCreatePayload,
  UserDelUserListCreatePayload,
  UserGetUserListListParams,
  UserMdfUserListCreatePayload,
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
   * @name UserGetUserListList
   * @summary 获取用户列表
   * @request GET:/user_get_user_list
   */
  userGetUserListList = (query: UserGetUserListListParams, params: RequestParams = {}) =>
    this.http.request<
      {
        code: number;
        data: {
          total: number;
          rows: {
            id?: number;
            userName?: string;
            role?: string;
            maxWindowCount?: number;
            useWindowCount?: number;
            status?: boolean;
            realName?: string;
            password?: string;
            staffIds?: number[];
            managerId?: number;
            grantGroupIds?: number[];
            avaWindowCount?: number;
            phone?: string;
            email?: string;
          }[];
        };
        msg: string;
      },
      any
    >({
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
   */
  userSelectStaffList = (params: RequestParams = {}) =>
    this.http.request<
      {
        code: number;
        data: {
          rows: {
            staffId: number;
            staffName: string;
          }[];
        };
        msg: string;
      },
      any
    >({
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
   */
  userSelectManagerList = (params: RequestParams = {}) =>
    this.http.request<
      {
        code: number;
        data: {
          rows: {
            managerId: number;
            managerName: string;
          }[];
        };
        msg: string;
      },
      any
    >({
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
   */
  userSelectGroupList = (params: RequestParams = {}) =>
    this.http.request<
      {
        code: number;
        data: {
          rows: {
            groupId: number;
            groupName: string;
            userName: string;
          }[];
        };
        msg: string;
      },
      any
    >({
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
   */
  userAddUserListCreate = (data: UserAddUserListCreatePayload, params: RequestParams = {}) =>
    this.http.request<
      {
        code: number;
        data: {
          create_by: number;
          group_user_id: number;
        };
        msg: string;
      },
      any
    >({
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
   */
  userMdfUserListCreate = (data: UserMdfUserListCreatePayload, params: RequestParams = {}) =>
    this.http.request<
      {
        code: number;
        msg: string;
      },
      any
    >({
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
   * @summary 员工管理->删除员工
   * @request POST:/user_del_user_list
   */
  userDelUserListCreate = (data: UserDelUserListCreatePayload, params: RequestParams = {}) =>
    this.http.request<
      {
        code: number;
        msg: string;
      },
      any
    >({
      path: `/user_del_user_list`,
      method: "POST",
      body: data,
      type: ContentType.Json,
      format: "json",
      ...params,
    });
}
