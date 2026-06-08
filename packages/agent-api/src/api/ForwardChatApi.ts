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
  ChatCompletionsV1ChatCompletionsPostData,
  ChatCompletionsV1ChatCompletionsPostError,
} from "./data-contracts";
import { HttpClient, RequestParams } from "./http-client";

export class ForwardChatApi<SecurityDataType = unknown> {
  http: HttpClient<SecurityDataType>;

  constructor(http: HttpClient<SecurityDataType>) {
    this.http = http;
  }

  /**
   * @description 转发至已配置的上游 Provider，按实际 Token 用量计费。非流式响应为 OpenAI `chat.completion` JSON；流式（`stream: true`）返回 `text/event-stream`。兼容路径：`/chat/completions`（无 `/v1` 前缀）。
   *
   * @tags Forward-Chat
   * @name ChatCompletionsV1ChatCompletionsPost
   * @summary OpenAI Chat 补全
   * @request POST:/v1/chat/completions
   * @response `200` `ChatCompletionsV1ChatCompletionsPostData` OpenAI 兼容的补全结果；流式时为 SSE 数据块。
   * @response `422` `HTTPValidationError` Validation Error
   */
  chatCompletionsV1ChatCompletionsPost = (params: RequestParams = {}) =>
    this.http.request<
      ChatCompletionsV1ChatCompletionsPostData,
      ChatCompletionsV1ChatCompletionsPostError
    >({
      path: `/v1/chat/completions`,
      method: "POST",
      format: "json",
      ...params,
    });
}
