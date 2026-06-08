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
  GetFileV1FilesFileIdGetData,
  GetFileV1FilesFileIdGetError,
  GetFileV1FilesFileIdGetParams,
  GetFileV2V2FilesFileIdGetData,
  GetFileV2V2FilesFileIdGetError,
  GetFileV2V2FilesFileIdGetParams,
  UploadFileV1FilesUploadPostData,
  UploadFileV1FilesUploadPostError,
  UploadFileV2V2FilesUploadPostData,
  UploadFileV2V2FilesUploadPostError,
} from "./data-contracts";
import { ContentType, HttpClient, RequestParams } from "./http-client";

export class 文件存储api<SecurityDataType = unknown> {
  http: HttpClient<SecurityDataType>;

  constructor(http: HttpClient<SecurityDataType>) {
    this.http = http;
  }

  /**
   * @description 上传图片或视频，需携带有效 API Key。返回文件 ID 和访问 URL。
   *
   * @tags 文件存储
   * @name UploadFileV1FilesUploadPost
   * @summary 上传文件
   * @request POST:/v1/files/upload
   * @response `200` `UploadFileV1FilesUploadPostData` Successful Response
   * @response `422` `HTTPValidationError` Validation Error
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
   * @description 通过文件 ID 直接访问已上传的图片或视频，无需鉴权。
   *
   * @tags 文件存储
   * @name GetFileV1FilesFileIdGet
   * @summary 访问文件
   * @request GET:/v1/files/{file_id}
   * @response `200` `GetFileV1FilesFileIdGetData` Successful Response
   * @response `422` `HTTPValidationError` Validation Error
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
      format: "json",
      ...params,
    });
  /**
   * @description 上传图片或视频到阿里云 OSS，需携带有效 API Key。返回文件 ID 和 OSS 访问 URL。
   *
   * @tags 文件存储
   * @name UploadFileV2V2FilesUploadPost
   * @summary 上传文件到 OSS
   * @request POST:/v2/files/upload
   * @response `200` `UploadFileV2V2FilesUploadPostData` Successful Response
   * @response `422` `HTTPValidationError` Validation Error
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
   * @description 通过文件 ID 访问 OSS 中的文件，返回 302 重定向到 OSS 公共 URL，无需鉴权。
   *
   * @tags 文件存储
   * @name GetFileV2V2FilesFileIdGet
   * @summary 访问 OSS 文件
   * @request GET:/v2/files/{file_id}
   * @response `200` `GetFileV2V2FilesFileIdGetData` Successful Response
   * @response `422` `HTTPValidationError` Validation Error
   */
  getFileV2V2FilesFileIdGet = (
    { fileId }: GetFileV2V2FilesFileIdGetParams,
    params: RequestParams = {},
  ) =>
    this.http.request<
      GetFileV2V2FilesFileIdGetData,
      GetFileV2V2FilesFileIdGetError
    >({
      path: `/v2/files/${fileId}`,
      method: "GET",
      format: "json",
      ...params,
    });
}
