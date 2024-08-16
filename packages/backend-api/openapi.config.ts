import path from 'node:path'
import { generateApi, generateTemplates } from 'swagger-typescript-api'

/* NOTE: all fields are optional expect one of `input`, `url`, `spec` */
generateApi({
  name: 'MySuperbApi.ts',
  // set to `false` to prevent the tool from writing to disk
  output: path.resolve(process.cwd(), './src/api'),
  url: 'http://127.0.0.1:4523/export/openapi/5?version=3.0',
  httpClientType: 'axios', // or "fetch"
  modular: true,
  //  generateRouteTypes: true,
  moduleNameFirstTag: true,
  moduleNameIndex: 1,
  extractRequestParams: true,
  extractRequestBody: true,
  extractEnums: true,
  unwrapResponseData: true,
  cleanOutput: true,
  hooks: {
  },
})
