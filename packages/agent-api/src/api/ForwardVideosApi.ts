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
  VideoGenerationsV1VideosGenerationsPostData,
  VideoGenerationsV1VideosGenerationsPostError,
} from "./data-contracts";
import { HttpClient, RequestParams } from "./http-client";

export class ForwardVideosApi<SecurityDataType = unknown> {
  http: HttpClient<SecurityDataType>;

  constructor(http: HttpClient<SecurityDataType>) {
    this.http = http;
  }

  /**
   * @description 创建视频生成任务（火山 v3 原生 body）；轮询 GET /v1/tasks/{task_id} 查询进度。
   *
   * @tags Forward-Videos
   * @name VideoGenerationsV1VideosGenerationsPost
   * @summary 异步视频生成
   * @request POST:/v1/videos/generations
   * @response `200` `VideoGenerationsV1VideosGenerationsPostData` Successful Response
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
  videoGenerationsV1VideosGenerationsPost = (params: RequestParams = {}) =>
    this.http.request<
      VideoGenerationsV1VideosGenerationsPostData,
      VideoGenerationsV1VideosGenerationsPostError
    >({
      path: `/v1/videos/generations`,
      method: "POST",
      format: "json",
      ...params,
    });
}
