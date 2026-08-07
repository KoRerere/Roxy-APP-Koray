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
  GetMediaTaskData,
  GetMediaTaskError,
  GetMediaTaskParams,
  ListMediaTasksData,
  ListMediaTasksError,
  ListMediaTasksParams,
} from "./data-contracts";
import { HttpClient, RequestParams } from "./http-client";

export class TasksApi<SecurityDataType = unknown> {
  http: HttpClient<SecurityDataType>;

  constructor(http: HttpClient<SecurityDataType>) {
    this.http = http;
  }

  /**
   * @description 按 task_id 查询生图任务状态；成功时 images 返回图片 URL 列表。
   *
   * @tags Tasks, Tasks
   * @name GetMediaTask
   * @summary 查询媒体异步任务
   * @request GET:/v1/tasks/{task_id}
   * @response `200` `GetMediaTaskData` Successful Response
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
  getMediaTask = ({ taskId }: GetMediaTaskParams, params: RequestParams = {}) =>
    this.http.request<GetMediaTaskData, GetMediaTaskError>({
      path: `/v1/tasks/${taskId}`,
      method: "GET",
      format: "json",
      ...params,
    });
  /**
   * @description 按 request_id 查询同一次请求产生的生图任务列表。
   *
   * @tags Tasks, Tasks
   * @name ListMediaTasks
   * @summary 按 request_id 批量查询媒体任务
   * @request GET:/v1/tasks
   * @response `200` `ListMediaTasksData` Successful Response
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
  listMediaTasks = (query: ListMediaTasksParams, params: RequestParams = {}) =>
    this.http.request<ListMediaTasksData, ListMediaTasksError>({
      path: `/v1/tasks`,
      method: "GET",
      query: query,
      format: "json",
      ...params,
    });
}
