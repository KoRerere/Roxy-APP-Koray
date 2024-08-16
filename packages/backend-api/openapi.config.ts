import path from 'node:path'
import { writeFileSync } from 'node:fs'
import { generateApi } from 'swagger-typescript-api'

/* NOTE: all fields are optional expect one of `input`, `url`, `spec` */
generateApi({
  name: 'MySuperbApi.ts',
  // set to `false` to prevent the tool from writing to disk
  output: path.resolve(process.cwd(), './src/api'),
  url: 'http://127.0.0.1:4523/export/openapi/4?version=3.1',
  httpClientType: 'axios', // or "fetch"
  modular: true,
  //  generateRouteTypes: true,
  moduleNameFirstTag: true,
  extractRequestParams: true,
  extractRequestBody: true,
  extractEnums: true,
  unwrapResponseData: true,
  cleanOutput: true,
  singleHttpClient: true,
  // templates: generateTemplates({

  // }),
  hooks: {
  },
}).then(({ files }) => {
  const content = files.reduce((acc, file) => {
    return `${acc}
export * from './${file.fileName}'`
  }, '')
  // 生成统一导出文件
  writeFileSync('./src/api/index.ts', content)
})
