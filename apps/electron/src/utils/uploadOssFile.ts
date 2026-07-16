import { aliOSS } from './oss'

export interface UploadOssFilePayload {
  localPath: string
  objectKey: string
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

export async function uploadOssFile({ localPath, objectKey }: UploadOssFilePayload) {
  const normalizedKey = normalizeObjectKey(objectKey)
  assertSafeObjectKey(normalizedKey)

  const { url } = await aliOSS.put(normalizedKey, localPath)
  return url
}
