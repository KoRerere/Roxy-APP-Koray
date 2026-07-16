/**
 * 临时：渲染进程直连 OSS 上传（获取 STS 凭证 + ali-oss put）。
 * 实名认证图片上传暂用此实现；后续切回主进程 IPC 后可删除本文件。
 */
import OSS from 'ali-oss'
import { API } from '/@/api'

export interface TempUploadOssFilePayload {
  objectKey: string
  file: File
}

function normalizeObjectKey(objectKey: string) {
  const trimmed = objectKey.trim()
  if (!trimmed)
    throw new Error('OSS object key is required')

  const normalized = trimmed.replace(/\\/g, '/').replace(/^\/+/, '')
  return `/${normalized}`
}

function assertSafeObjectKey(objectKey: string) {
  if (objectKey.includes('..'))
    throw new Error('Invalid OSS object key')

  const withoutLeadingSlash = objectKey.replace(/^\/+/, '')
  if (!withoutLeadingSlash.startsWith('groupdata/'))
    throw new Error('OSS object key must start with groupdata/')
}

async function createOssClient() {
  const { code, data, msg } = await API.base.userGetOssCredentialV2List()
  if (code !== 0)
    throw new Error(msg || 'Failed to get OSS credentials')

  return new OSS({
    region: data.region,
    accessKeyId: data.accessKeyId,
    accessKeySecret: data.accessKeySecret,
    bucket: data.bucket,
    stsToken: data.securityToken,
    refreshSTSToken: async () => {
      const refreshed = await API.base.userGetOssCredentialV2List()
      if (refreshed.code !== 0)
        throw new Error(refreshed.msg || 'Failed to refresh OSS credentials')

      return {
        accessKeyId: refreshed.data.accessKeyId,
        accessKeySecret: refreshed.data.accessKeySecret,
        stsToken: refreshed.data.securityToken,
      }
    },
    refreshSTSTokenInterval: 8 * 60 * 1000,
  })
}

export async function tempUploadOssFile({ objectKey, file }: TempUploadOssFilePayload) {
  const normalizedKey = normalizeObjectKey(objectKey)
  assertSafeObjectKey(normalizedKey)

  const client = await createOssClient()
  const { url } = await client.put(normalizedKey, file)
  return url
}
