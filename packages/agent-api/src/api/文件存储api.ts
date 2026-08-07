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
  GetFileV1FilesFileIdGetData,
  GetFileV1FilesFileIdGetError,
  GetFileV1FilesFileIdGetParams,
  GetFileV2V2FilesFileIdGetError,
  GetFileV2V2FilesFileIdGetParams,
} from "./data-contracts";
import { HttpClient, RequestParams } from "./http-client";

export class 文件存储api<SecurityDataType = unknown> {
  http: HttpClient<SecurityDataType>;

  constructor(http: HttpClient<SecurityDataType>) {
    this.http = http;
  }

  /**
   * @description 通过文件 ID 直接访问已上传的图片或视频，无需鉴权。
   *
   * @tags 文件存储
   * @name GetFileV1FilesFileIdGet
   * @summary 访问文件
   * @request GET:/v1/files/{file_id}
   * @response `200` `GetFileV1FilesFileIdGetData` Successful Response
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
  getFileV1FilesFileIdGet = (
    { fileId }: GetFileV1FilesFileIdGetParams,
    params: RequestParams = {},
  ) =>
    this.http.request<
      GetFileV1FilesFileIdGetData,
      GetFileV1FilesFileIdGetError
    >({
      path: `/v1/files/${fileId}`,
      method: "GET",
      ...params,
    });
  /**
   * @description 通过文件 ID 访问 OSS 中的文件，返回 302 重定向到 OSS 公共 URL，无需鉴权。
   *
   * @tags 文件存储
   * @name GetFileV2V2FilesFileIdGet
   * @summary 访问 OSS 文件
   * @request GET:/v2/files/{file_id}
   * @response `302` `void` Successful Response
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
  getFileV2V2FilesFileIdGet = (
    { fileId }: GetFileV2V2FilesFileIdGetParams,
    params: RequestParams = {},
  ) =>
    this.http.request<any, GetFileV2V2FilesFileIdGetError>({
      path: `/v2/files/${fileId}`,
      method: "GET",
      ...params,
    });
}
