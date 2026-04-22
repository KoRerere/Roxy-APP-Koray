import OSS from 'ali-oss'
import { API } from '../api'

export async function createAliOSSStore(headers: Record<string, any>) {
  const { code, data, msg } = await API.base.userGetOssCredentialV2List({ headers })

  if (code !== 0) {
    console.error('创建 AliOSS 实例失败', code, data, msg)
    return Promise.reject(msg)
  }

  return new OSS({
    region: data.region,
    accessKeyId: data.accessKeyId,
    accessKeySecret: data.accessKeySecret,
    bucket: data.bucket,
    stsToken: data.securityToken,
  })
}
