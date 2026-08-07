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
  AnthropicMessagesV1MessagesPostData,
  AnthropicMessagesV1MessagesPostError,
} from "./data-contracts";
import { HttpClient, RequestParams } from "./http-client";

export class ForwardMessagesApi<SecurityDataType = unknown> {
  http: HttpClient<SecurityDataType>;

  constructor(http: HttpClient<SecurityDataType>) {
    this.http = http;
  }

  /**
   * @description Anthropic Messages API 兼容转发。根据模型配置的 `api_format` 与 Provider 路由到上游；流式时返回 SSE。兼容路径：`/messages`（无 `/v1` 前缀）。
   *
   * @tags Forward-Messages
   * @name AnthropicMessagesV1MessagesPost
   * @summary Anthropic Messages
   * @request POST:/v1/messages
   * @response `200` `AnthropicMessagesV1MessagesPostData` Anthropic 兼容的 message 对象；流式时为 SSE 事件流。
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
  anthropicMessagesV1MessagesPost = (params: RequestParams = {}) =>
    this.http.request<
      AnthropicMessagesV1MessagesPostData,
      AnthropicMessagesV1MessagesPostError
    >({
      path: `/v1/messages`,
      method: "POST",
      format: "json",
      ...params,
    });
}
