import type { AiAgentJsonRequestOptions } from './aiAgentClient'
import { aiAgentClient } from './aiAgentClient'

export interface FileUploadResult {
  file_id: string
  filename: string
  content_type: string
  size: number
  /** 可永久访问的 OSS URL */
  url: string
}

export class AiAgentFilesApi {
  /**
   * 上传文件到 AI Agent 服务端（V2 接口）
   * @param file - 文件 Blob
   * @param fileName - 文件名
   * @param options - 额外请求选项
   * @returns 上传后的文件信息，包含 file_id、url 等
   */
  upload(file: Blob, fileName: string, options: AiAgentJsonRequestOptions = {}) {
    const formData = new FormData()
    formData.append('file', file, fileName)
    return aiAgentClient.post<FileUploadResult>('/v2/files/upload', {
      ...options,
      body: formData,
    })
  }
}

export const aiAgentFilesApi = new AiAgentFilesApi()
