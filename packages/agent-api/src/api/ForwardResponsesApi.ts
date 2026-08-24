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
  ResponsesV1ResponsesPostData,
  ResponsesV1ResponsesPostError,
} from "./data-contracts";
import { HttpClient, RequestParams } from "./http-client";

export class ForwardResponsesApi<SecurityDataType = unknown> {
  http: HttpClient<SecurityDataType>;

  constructor(http: HttpClient<SecurityDataType>) {
    this.http = http;
  }

  /**
   * @description OpenAI Responses API 兼容转发，按最终 response.usage 计费。流式请求原样返回语义化 SSE 事件，不追加 Chat Completions 的 [DONE]。兼容路径：`/responses`（无 `/v1` 前缀）。
   *
   * @tags Forward-Responses
   * @name ResponsesV1ResponsesPost
   * @summary OpenAI Responses
   * @request POST:/v1/responses
   * @response `200` `ResponsesV1ResponsesPostData` OpenAI 兼容的 response 对象；流式时为语义化 SSE 事件流。
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
  responsesV1ResponsesPost = (params: RequestParams = {}) =>
    this.http.request<
      ResponsesV1ResponsesPostData,
      ResponsesV1ResponsesPostError
    >({
      path: `/v1/responses`,
      method: "POST",
      format: "json",
      ...params,
    });
}
