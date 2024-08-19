import OSS from 'ali-oss'
import type { UserGetOssCredentialListData } from '@roxy/backend-api'
import { API } from '../api'

const _aliOSS = new class AliOSS {
  store!: OSS
  timer?: NodeJS.Timeout
  /** 避免重复请求 */
  promise?: Promise<UserGetOssCredentialListData>

  constructor() {
    this.refreshUploadTokenInterval()
  }

  /**
   * 定时刷新 OSS 上传凭证
   */
  async refreshUploadTokenInterval() {
    this.promise ||= API.base.userGetOssCredentialList()
    const { data } = await this.promise.finally(() => {
      this.promise = undefined
    })
    this.store = new OSS({
      region: data.region,
      accessKeyId: data.accessKeyId,
      accessKeySecret: data.accessKeySecret,
      bucket: data.bucket,
      stsToken: data.securityToken,
    })
    // 避免存在多个定时器
    clearTimeout(this.timer)
    // 提前 2 分钟刷新
    const timeout = +new Date(data.expiration) - Date.now() - 1000 * 60 * 2
    this.timer = setTimeout(() => {
      this.refreshUploadTokenInterval()
    }, timeout)
  }
}()

export const aliOSS = new Proxy({} as OSS, {
  get(target, key: keyof OSS) {
    return async (...args: any[]) => {
      try {
        return Reflect.apply(_aliOSS.store[key], _aliOSS.store, args)
      }
      catch (error) {
        console.error('aliOSS error', error)
        await _aliOSS.refreshUploadTokenInterval()
        return Reflect.apply(_aliOSS.store[key], _aliOSS.store, args)
      }
    }
  },
})

// 测试下载文件
// aliOSS.get('groupdata/14017/window/232a04dd3ecde84d47713fca0955d96a/99c71cb82dc81513d3aa774d156012d1.zip', join(__dirname, 'example.zip')).then(() => {
//   console.log('download success')
// }).catch((error) => {
//   console.error('download error', error)
// })
