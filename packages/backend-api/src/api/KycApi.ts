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
  KycEnterpriseSubmitData,
  KycEnterpriseSubmitRequest,
  KycPersonalSubmitData,
  KycPersonalSubmitRequest,
  KycStatusData,
  WorkspaceStatusListData,
} from "./data-contracts";
import { ContentType, HttpClient, RequestParams } from "./http-client";

export class KycApi<SecurityDataType = unknown> {
  http: HttpClient<SecurityDataType>;

  constructor(http: HttpClient<SecurityDataType>) {
    this.http = http;
  }

  /**
   * @description 判断 header 工作空间是否已解锁。data 仅返回 unlocked：true 表示该空间 Owner 个人或企业实名已通过；与当前登录用户本人 KYC 无关。需对该空间有团队权限。
   *
   * @tags KYC
   * @name WorkspaceStatusList
   * @summary 查询工作空间 KYC 解锁状态
   * @request GET:/user_kyc/workspace/status
   * @response `200` `WorkspaceStatusListData` data 仅含 unlocked。
   */
  workspaceStatusList = (params: RequestParams = {}) =>
    this.http.request<WorkspaceStatusListData, any>({
      path: `/user_kyc/workspace/status`,
      method: "GET",
      format: "json",
      ...params,
    });
  /**
   * @description 提交个人实名认证。同一身份证号在其他账号处于审核中或已通过时不可再提交（一人一账号）。国徽面需能识别签发机关与有效期，随机图片会审核失败。workspaceId 请求头可选，仅作审计。
   *
   * @tags KYC
   * @name KycPersonalSubmit
   * @summary 提交个人实名认证
   * @request POST:/user_kyc/personal/submit
   * @response `200` `KycPersonalSubmitData` 提交成功，进入审核中
   */
  kycPersonalSubmit = (
    data: KycPersonalSubmitRequest,
    params: RequestParams = {},
  ) =>
    this.http.request<KycPersonalSubmitData, any>({
      path: `/user_kyc/personal/submit`,
      method: "POST",
      body: data,
      type: ContentType.Json,
      format: "json",
      ...params,
    });
  /**
   * @description 提交企业实名认证，绑定当前登录用户（非工作空间）。通过后该用户作为 Owner 的全部工作空间可解锁；workspaceId 请求头仅用于审计当前提交所在空间，非认证主体。不要求当前空间角色为 Owner。
   *
   * @tags KYC
   * @name KycEnterpriseSubmit
   * @summary 提交企业实名认证
   * @request POST:/user_kyc/enterprise/submit
   * @response `200` `KycEnterpriseSubmitData` 提交成功，进入审核中
   */
  kycEnterpriseSubmit = (
    data: KycEnterpriseSubmitRequest,
    params: RequestParams = {},
  ) =>
    this.http.request<KycEnterpriseSubmitData, any>({
      path: `/user_kyc/enterprise/submit`,
      method: "POST",
      body: data,
      type: ContentType.Json,
      format: "json",
      ...params,
    });
  /**
   * @description 查询当前用户个人认证与企业认证状态（均按用户）。有记录时返回提交字段及 *Masked 脱敏字段；个人附带用户绑定 phone。unlocked：仅当 header 中工作空间的 Owner 个人或企业实名已通过（与本人 KYC 无关）。
   *
   * @tags KYC
   * @name KycStatus
   * @summary 查询 KYC 状态
   * @request GET:/user_kyc/status
   * @response `200` `KycStatusData` personal/enterprise 为本人状态；unlocked 仅看空间 Owner 是否实名。
   */
  kycStatus = (params: RequestParams = {}) =>
    this.http.request<KycStatusData, any>({
      path: `/user_kyc/status`,
      method: "GET",
      format: "json",
      ...params,
    });
}
