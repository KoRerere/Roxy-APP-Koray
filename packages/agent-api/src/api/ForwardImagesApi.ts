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
  ImageEditsV1ImagesEditsPostData,
  ImageEditsV1ImagesEditsPostError,
  ImageGenerationsV1ImagesGenerationsPostData,
  ImageGenerationsV1ImagesGenerationsPostError,
} from "./data-contracts";
import { HttpClient, RequestParams } from "./http-client";

export class ForwardImagesApi<SecurityDataType = unknown> {
  http: HttpClient<SecurityDataType>;

  constructor(http: HttpClient<SecurityDataType>) {
    this.http = http;
  }

  /**
   * @description 创建生图任务并立即返回 task_id；客户端轮询 GET /v1/tasks/{task_id} 查询进度。
   *
   * @tags Forward-Images
   * @name ImageGenerationsV1ImagesGenerationsPost
   * @summary 异步文生图
   * @request POST:/v1/images/generations
   * @response `200` `ImageGenerationsV1ImagesGenerationsPostData` Successful Response
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
  imageGenerationsV1ImagesGenerationsPost = (params: RequestParams = {}) =>
    this.http.request<
      ImageGenerationsV1ImagesGenerationsPostData,
      ImageGenerationsV1ImagesGenerationsPostError
    >({
      path: `/v1/images/generations`,
      method: "POST",
      format: "json",
      ...params,
    });
  /**
   * @description 创建编辑任务并立即返回 task_id；支持 multipart 与 JSON。
   *
   * @tags Forward-Images
   * @name ImageEditsV1ImagesEditsPost
   * @summary 异步图片编辑
   * @request POST:/v1/images/edits
   * @response `200` `ImageEditsV1ImagesEditsPostData` Successful Response
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
  imageEditsV1ImagesEditsPost = (params: RequestParams = {}) =>
    this.http.request<
      ImageEditsV1ImagesEditsPostData,
      ImageEditsV1ImagesEditsPostError
    >({
      path: `/v1/images/edits`,
      method: "POST",
      format: "json",
      ...params,
    });
}
