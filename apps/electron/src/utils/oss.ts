import type { UserGetOssCredentialListData } from '@roxy/backend-api'
import type { ReadStream } from 'node:fs'
import OSS from 'ali-oss'
import { createWriteStream } from 'node:fs'
import { API } from '../api'

const _aliOSS = new class AliOSS {
  store = {} as OSS
  #timer?: NodeJS.Timeout
  /** 避免重复请求 */
  promise?: Promise<UserGetOssCredentialListData>

  constructor() {
    this.refreshUploadTokenInterval()
  }

  /** 用户切换账号之后需要重新 init */
  init() {
    this.promise = undefined
    // 定时刷新 OSS 上传凭证
    this.refreshUploadTokenInterval()
  }

  /**
   * 定时刷新 OSS 上传凭证
   */
  async refreshUploadTokenInterval() {
    this.promise ||= API.base.userGetOssCredentialV2List()
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
    clearTimeout(this.#timer)
    // 提前 2 分钟刷新
    const timeout = +new Date(data.expiration) - Date.now() - 1000 * 60 * 2
    this.#timer = setTimeout(() => {
      this.refreshUploadTokenInterval()
    }, timeout)
  }

  /** 流式下载文件到本地 */
  async getStreamPromise(remotePath: string, localPath: string) {
    const { promise, reject, resolve } = Promise.withResolvers()
    // 填写Object完整路径。Object完整路径中不能包含Bucket名称。
    const result = await this.store.getStream(remotePath)

    // 可读流实例。如果响应状态不是200，则 stream 将为null
    const readStream: ReadStream = result.stream
    if (!readStream) {
      return reject(new Error('stream is null'))
    }

    // 填写本地文件的完整路径。如果指定的本地文件存在会覆盖，不存在则新建。
    const writeStream = createWriteStream(localPath)
    result.stream.pipe(writeStream)
    readStream.on('end', resolve)
    readStream.on('error', reject)

    return promise
  }
}()

export const aliOSS = new Proxy({} as OSS & typeof _aliOSS, {
  get(_, key: keyof OSS) {
    const target = Reflect.has(_aliOSS.store, key) ? _aliOSS.store : _aliOSS
    return async (...args: any[]) => {
      try {
        return Reflect.apply(target[key], target, args)
      }
      catch (error) {
        console.error('aliOSS error', error)
        await _aliOSS.refreshUploadTokenInterval()
        return Reflect.apply(target[key], target, args)
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
