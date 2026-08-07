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
  FeedbackCreateRequest,
  SubmitFeedbackData,
  SubmitFeedbackError,
} from "./data-contracts";
import { ContentType, HttpClient, RequestParams } from "./http-client";

export class FeedbackApi<SecurityDataType = unknown> {
  http: HttpClient<SecurityDataType>;

  constructor(http: HttpClient<SecurityDataType>) {
    this.http = http;
  }

  /**
   * @description 提交反馈（联系方式 + 内容 + 图片）。图片需先调用 /v2/files/upload 上传，再将返回的 file_id 列表随请求提交；后端校验 file_id 归属当前用户后落库。
   *
   * @tags Feedback, Feedback
   * @name SubmitFeedback
   * @summary 提交用户反馈
   * @request POST:/v1/feedback
   * @response `200` `SubmitFeedbackData` Successful Response
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
  submitFeedback = (data: FeedbackCreateRequest, params: RequestParams = {}) =>
    this.http.request<SubmitFeedbackData, SubmitFeedbackError>({
      path: `/v1/feedback`,
      method: "POST",
      body: data,
      type: ContentType.Json,
      format: "json",
      ...params,
    });
}
