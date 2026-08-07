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
  CreateUserTaskData,
  CreateUserTaskError,
  DeleteUserTaskData,
  DeleteUserTaskError,
  DeleteUserTaskParams,
  GetUserTaskData,
  GetUserTaskError,
  GetUserTaskParams,
  HeartbeatUserTaskData,
  HeartbeatUserTaskError,
  HeartbeatUserTaskParams,
  ListUserTasksData,
  ListUserTasksError,
  ListUserTasksParams,
  TaskHeartbeatRequest,
  TaskStateRequest,
  UpdateUserTaskData,
  UpdateUserTaskError,
  UpdateUserTaskParams,
  UpdateUserTaskStateData,
  UpdateUserTaskStateError,
  UpdateUserTaskStateParams,
  UserTaskCreate,
  UserTaskUpdate,
} from "./data-contracts";
import { ContentType, HttpClient, RequestParams } from "./http-client";

export class UserTasksApi<SecurityDataType = unknown> {
  http: HttpClient<SecurityDataType>;

  constructor(http: HttpClient<SecurityDataType>) {
    this.http = http;
  }

  /**
   * No description
   *
   * @tags UserTasks
   * @name CreateUserTask
   * @summary 创建用户任务（基于用户模板）
   * @request POST:/v1/user/tasks
   * @response `200` `CreateUserTaskData` Successful Response
   * @response `400` `ApiErrorResponse` Bad Request
   * @response `401` `ApiErrorResponse` Unauthorized
   * @response `402` `ApiErrorResponse` Payment Required
   * @response `403` `ApiErrorResponse` Forbidden
   * @response `404` `ApiErrorResponse` Not Found
   * @response `409` `ApiErrorResponse` Conflict
   * @response `413` `ApiErrorResponse` Request Entity Too Large
   * @response `415` `ApiErrorResponse` Unsupported Media Type
   * @response `422` `ApiErrorResponse` Unprocessable Entity
   * @response `429` `ApiErrorResponse` Too Many Requests
   * @response `500` `ApiErrorResponse` Internal Server Error
   * @response `503` `ApiErrorResponse` Service Unavailable
   * @response `504` `ApiErrorResponse` Gateway Timeout
   */
  createUserTask = (data: UserTaskCreate, params: RequestParams = {}) =>
    this.http.request<CreateUserTaskData, CreateUserTaskError>({
      path: `/v1/user/tasks`,
      method: "POST",
      body: data,
      type: ContentType.Json,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags UserTasks
   * @name ListUserTasks
   * @summary 分页列出用户任务
   * @request GET:/v1/user/tasks
   * @response `200` `ListUserTasksData` Successful Response
   * @response `400` `ApiErrorResponse` Bad Request
   * @response `401` `ApiErrorResponse` Unauthorized
   * @response `402` `ApiErrorResponse` Payment Required
   * @response `403` `ApiErrorResponse` Forbidden
   * @response `404` `ApiErrorResponse` Not Found
   * @response `409` `ApiErrorResponse` Conflict
   * @response `413` `ApiErrorResponse` Request Entity Too Large
   * @response `415` `ApiErrorResponse` Unsupported Media Type
   * @response `422` `ApiErrorResponse` Unprocessable Entity
   * @response `429` `ApiErrorResponse` Too Many Requests
   * @response `500` `ApiErrorResponse` Internal Server Error
   * @response `503` `ApiErrorResponse` Service Unavailable
   * @response `504` `ApiErrorResponse` Gateway Timeout
   */
  listUserTasks = (query: ListUserTasksParams, params: RequestParams = {}) =>
    this.http.request<ListUserTasksData, ListUserTasksError>({
      path: `/v1/user/tasks`,
      method: "GET",
      query: query,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags UserTasks
   * @name GetUserTask
   * @summary 获取用户任务详情
   * @request GET:/v1/user/tasks/{task_id}
   * @response `200` `GetUserTaskData` Successful Response
   * @response `400` `ApiErrorResponse` Bad Request
   * @response `401` `ApiErrorResponse` Unauthorized
   * @response `402` `ApiErrorResponse` Payment Required
   * @response `403` `ApiErrorResponse` Forbidden
   * @response `404` `ApiErrorResponse` Not Found
   * @response `409` `ApiErrorResponse` Conflict
   * @response `413` `ApiErrorResponse` Request Entity Too Large
   * @response `415` `ApiErrorResponse` Unsupported Media Type
   * @response `422` `ApiErrorResponse` Unprocessable Entity
   * @response `429` `ApiErrorResponse` Too Many Requests
   * @response `500` `ApiErrorResponse` Internal Server Error
   * @response `503` `ApiErrorResponse` Service Unavailable
   * @response `504` `ApiErrorResponse` Gateway Timeout
   */
  getUserTask = ({ taskId }: GetUserTaskParams, params: RequestParams = {}) =>
    this.http.request<GetUserTaskData, GetUserTaskError>({
      path: `/v1/user/tasks/${taskId}`,
      method: "GET",
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags UserTasks
   * @name UpdateUserTask
   * @summary 更新用户任务
   * @request PUT:/v1/user/tasks/{task_id}
   * @response `200` `UpdateUserTaskData` Successful Response
   * @response `400` `ApiErrorResponse` Bad Request
   * @response `401` `ApiErrorResponse` Unauthorized
   * @response `402` `ApiErrorResponse` Payment Required
   * @response `403` `ApiErrorResponse` Forbidden
   * @response `404` `ApiErrorResponse` Not Found
   * @response `409` `ApiErrorResponse` Conflict
   * @response `413` `ApiErrorResponse` Request Entity Too Large
   * @response `415` `ApiErrorResponse` Unsupported Media Type
   * @response `422` `ApiErrorResponse` Unprocessable Entity
   * @response `429` `ApiErrorResponse` Too Many Requests
   * @response `500` `ApiErrorResponse` Internal Server Error
   * @response `503` `ApiErrorResponse` Service Unavailable
   * @response `504` `ApiErrorResponse` Gateway Timeout
   */
  updateUserTask = (
    { taskId }: UpdateUserTaskParams,
    data: UserTaskUpdate,
    params: RequestParams = {},
  ) =>
    this.http.request<UpdateUserTaskData, UpdateUserTaskError>({
      path: `/v1/user/tasks/${taskId}`,
      method: "PUT",
      body: data,
      type: ContentType.Json,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags UserTasks
   * @name DeleteUserTask
   * @summary 删除用户任务
   * @request DELETE:/v1/user/tasks/{task_id}
   * @response `200` `DeleteUserTaskData` Successful Response
   * @response `400` `ApiErrorResponse` Bad Request
   * @response `401` `ApiErrorResponse` Unauthorized
   * @response `402` `ApiErrorResponse` Payment Required
   * @response `403` `ApiErrorResponse` Forbidden
   * @response `404` `ApiErrorResponse` Not Found
   * @response `409` `ApiErrorResponse` Conflict
   * @response `413` `ApiErrorResponse` Request Entity Too Large
   * @response `415` `ApiErrorResponse` Unsupported Media Type
   * @response `422` `ApiErrorResponse` Unprocessable Entity
   * @response `429` `ApiErrorResponse` Too Many Requests
   * @response `500` `ApiErrorResponse` Internal Server Error
   * @response `503` `ApiErrorResponse` Service Unavailable
   * @response `504` `ApiErrorResponse` Gateway Timeout
   */
  deleteUserTask = (
    { taskId }: DeleteUserTaskParams,
    params: RequestParams = {},
  ) =>
    this.http.request<DeleteUserTaskData, DeleteUserTaskError>({
      path: `/v1/user/tasks/${taskId}`,
      method: "DELETE",
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags UserTasks
   * @name UpdateUserTaskState
   * @summary 申请或结束任务执行租约
   * @request POST:/v1/user/tasks/{task_id}/state
   * @response `200` `UpdateUserTaskStateData` Successful Response
   * @response `400` `ApiErrorResponse` Bad Request
   * @response `401` `ApiErrorResponse` Unauthorized
   * @response `402` `ApiErrorResponse` Payment Required
   * @response `403` `ApiErrorResponse` Forbidden
   * @response `404` `ApiErrorResponse` Not Found
   * @response `409` `ApiErrorResponse` Conflict
   * @response `413` `ApiErrorResponse` Request Entity Too Large
   * @response `415` `ApiErrorResponse` Unsupported Media Type
   * @response `422` `ApiErrorResponse` Unprocessable Entity
   * @response `429` `ApiErrorResponse` Too Many Requests
   * @response `500` `ApiErrorResponse` Internal Server Error
   * @response `503` `ApiErrorResponse` Service Unavailable
   * @response `504` `ApiErrorResponse` Gateway Timeout
   */
  updateUserTaskState = (
    { taskId }: UpdateUserTaskStateParams,
    data: TaskStateRequest,
    params: RequestParams = {},
  ) =>
    this.http.request<UpdateUserTaskStateData, UpdateUserTaskStateError>({
      path: `/v1/user/tasks/${taskId}/state`,
      method: "POST",
      body: data,
      type: ContentType.Json,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags UserTasks
   * @name HeartbeatUserTask
   * @summary 续租任务执行租约
   * @request POST:/v1/user/tasks/{task_id}/heartbeat
   * @response `200` `HeartbeatUserTaskData` Successful Response
   * @response `400` `ApiErrorResponse` Bad Request
   * @response `401` `ApiErrorResponse` Unauthorized
   * @response `402` `ApiErrorResponse` Payment Required
   * @response `403` `ApiErrorResponse` Forbidden
   * @response `404` `ApiErrorResponse` Not Found
   * @response `409` `ApiErrorResponse` Conflict
   * @response `413` `ApiErrorResponse` Request Entity Too Large
   * @response `415` `ApiErrorResponse` Unsupported Media Type
   * @response `422` `ApiErrorResponse` Unprocessable Entity
   * @response `429` `ApiErrorResponse` Too Many Requests
   * @response `500` `ApiErrorResponse` Internal Server Error
   * @response `503` `ApiErrorResponse` Service Unavailable
   * @response `504` `ApiErrorResponse` Gateway Timeout
   */
  heartbeatUserTask = (
    { taskId }: HeartbeatUserTaskParams,
    data: TaskHeartbeatRequest,
    params: RequestParams = {},
  ) =>
    this.http.request<HeartbeatUserTaskData, HeartbeatUserTaskError>({
      path: `/v1/user/tasks/${taskId}/heartbeat`,
      method: "POST",
      body: data,
      type: ContentType.Json,
      format: "json",
      ...params,
    });
}
