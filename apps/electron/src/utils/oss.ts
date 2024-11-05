import type { UserGetOssCredentialListData } from '@roxy/backend-api'
import type { ReadStream } from 'node:fs'
import OSS from 'ali-oss'
import { createWriteStream } from 'node:fs'
import { isPackaged } from '/@/utils'
import { API } from '../api'

const _aliOSS = new class AliOSS {
  store = {} as OSS
  // #timer?: NodeJS.Timeout
  // /** 避免重复请求 */
  // controller: AbortController | null = null

  constructor() {
    // this.refreshUploadTokenInterval()
  }

  /** 用户切换账号之后需要重新 init */
  init() {
    // 定时刷新 OSS 上传凭证
    // this.refreshUploadTokenInterval()
  }

  /**
   * 定时刷新 OSS 上传凭证
   */
  async refreshUploadTokenInterval() {
    // 如果上一次请求还没结束，取消上一次请求
    // if (this.controller) {
    //   this.controller.abort() // 中止之前的请求
    // }

    // 创建一个新的 AbortController 实例
    // this.controller = new AbortController()
    // const { signal } = this.controller

    // TODO 上传凭证接口
    const { data } = await API.base.userGetOssCredentialV2List({})
    // .finally(() => {
    //   this.controller = null
    // })

    this.store = new OSS({
      region: data.region,
      accessKeyId: data.accessKeyId,
      accessKeySecret: data.accessKeySecret,
      bucket: data.bucket,
      stsToken: data.securityToken,
    })
    console.log('aliOSS init success', data)
    // 避免存在多个定时器
    // clearTimeout(this.#timer)
    // 提前 2 分钟刷新
    // const timeout = +new Date(data.expiration) - Date.now() - 1000 * 60 * 2
    // this.#timer = setTimeout(() => {
    //   this.refreshUploadTokenInterval()
    // }, timeout)
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
    return async (...args: any[]) => {
      // 每次都重新获取上传凭证
      await _aliOSS.refreshUploadTokenInterval()
      const target = Reflect.has(_aliOSS.store, key) ? _aliOSS.store : _aliOSS

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
