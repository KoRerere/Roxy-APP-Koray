import AliOss from 'ali-oss'
import { Buffer } from 'node:buffer'

const baseOssConfig = {
  region: 'oss-cn-beijing',
  accessKeyId: 'LTAI5t5yXNqb9bYuXN9E4ecC',
  accessKeySecret: 'FPYbMZxc1jbPAP1byjoxpfYb9T1X7B',
  bucket: 'roxy-web',
}
async function startUpload() {
  // console.log('ossConfig',ossConfig)
  const ossClient = new AliOss({
    ...baseOssConfig,
  })
  console.log('上传 web 资源包中...')
  const data = Buffer.from(
    JSON.stringify({
      version: '1.0.0',
      minimum_app_version: '1.0.0',
    }),
  )

  // 获取列表
  const list = await ossClient.listV2({
    prefix: 'faq/',
  })
  console.log('list', list)

  const uploadVersionRes = await ossClient.put(
    `/faq/web/version.json`,
    data,
  )
  console.log('上传版本号成功：', uploadVersionRes.url)
}

startUpload()
