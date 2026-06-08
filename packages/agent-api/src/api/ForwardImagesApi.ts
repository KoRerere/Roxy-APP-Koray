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
   * @description Forward image generation requests to the configured upstream provider. Image quota is checked before forwarding and deducted after successful generation.
   *
   * @tags Forward-Images
   * @name ImageGenerationsV1ImagesGenerationsPost
   * @summary OpenAI image generations
   * @request POST:/v1/images/generations
   * @response `200` `ImageGenerationsV1ImagesGenerationsPostData` Successful Response
   * @response `422` `HTTPValidationError` Validation Error
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
   * @description Forward image edit requests to the configured upstream provider. Image quota is checked before forwarding and deducted after successful editing.
   *
   * @tags Forward-Images
   * @name ImageEditsV1ImagesEditsPost
   * @summary OpenAI image edits
   * @request POST:/v1/images/edits
   * @response `200` `ImageEditsV1ImagesEditsPostData` Successful Response
   * @response `422` `HTTPValidationError` Validation Error
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
