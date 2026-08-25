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
  BodyUploadFileV1FilesUploadPost,
  BodyUploadFileV2V2FilesUploadPost,
  BodyUploadFileV3V3FilesUploadPost,
  UploadFileV1FilesUploadPostData,
  UploadFileV1FilesUploadPostError,
  UploadFileV2V2FilesUploadPostData,
  UploadFileV2V2FilesUploadPostError,
  UploadFileV3V3FilesUploadPostData,
  UploadFileV3V3FilesUploadPostError,
} from "./data-contracts";
import { ContentType, HttpClient, RequestParams } from "./http-client";

export class FilesApi<SecurityDataType = unknown> {
  http: HttpClient<SecurityDataType>;

  constructor(http: HttpClient<SecurityDataType>) {
    this.http = http;
  }

  /**
   * @description 上传图片或视频，需携带有效 API Key。返回文件 ID 和访问 URL。
   *
   * @tags Files
   * @name UploadFileV1FilesUploadPost
   * @summary 上传文件
   * @request POST:/v1/files/upload
   * @response `200` `UploadFileV1FilesUploadPostData` Successful Response
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
  uploadFileV1FilesUploadPost = (
    data: BodyUploadFileV1FilesUploadPost,
    params: RequestParams = {},
  ) =>
    this.http.request<
      UploadFileV1FilesUploadPostData,
      UploadFileV1FilesUploadPostError
    >({
      path: `/v1/files/upload`,
      method: "POST",
      body: data,
      type: ContentType.FormData,
      format: "json",
      ...params,
    });
  /**
   * @description 上传图片或视频到阿里云 OSS，需携带有效 API Key。返回文件 ID 和 OSS 访问 URL。
   *
   * @tags Files
   * @name UploadFileV2V2FilesUploadPost
   * @summary 上传文件到 OSS
   * @request POST:/v2/files/upload
   * @response `200` `UploadFileV2V2FilesUploadPostData` Successful Response
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
  uploadFileV2V2FilesUploadPost = (
    data: BodyUploadFileV2V2FilesUploadPost,
    params: RequestParams = {},
  ) =>
    this.http.request<
      UploadFileV2V2FilesUploadPostData,
      UploadFileV2V2FilesUploadPostError
    >({
      path: `/v2/files/upload`,
      method: "POST",
      body: data,
      type: ContentType.FormData,
      format: "json",
      ...params,
    });
  /**
   * @description 上传文件到 OSS；forward=true 时，根据 model 对应的 Provider 同时上传到上游文件服务。
   *
   * @tags Files
   * @name UploadFileV3V3FilesUploadPost
   * @summary 上传文件并按模型转发
   * @request POST:/v3/files/upload
   * @response `200` `UploadFileV3V3FilesUploadPostData` Successful Response
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
  uploadFileV3V3FilesUploadPost = (
    data: BodyUploadFileV3V3FilesUploadPost,
    params: RequestParams = {},
  ) =>
    this.http.request<
      UploadFileV3V3FilesUploadPostData,
      UploadFileV3V3FilesUploadPostError
    >({
      path: `/v3/files/upload`,
      method: "POST",
      body: data,
      type: ContentType.FormData,
      format: "json",
      ...params,
    });
}
