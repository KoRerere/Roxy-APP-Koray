// import type { ApiConfig } from './api/'
// import { HttpClient } from './api/'

export * from './api'
export * from './types'

// export const modules = import.meta.glob<any>('./api/*.ts', { eager: true })

// export function setupHttpClient(options: ApiConfig = {}) {
//   const httpClient = new HttpClient({
//     ...options,
//     baseURL: 'https://lumitest.lumibrowser.com/',
//   })

//   const filters = ['data-contracts', 'http-client'].map(name => `./api/${name}.ts`)

//   const apiObj = Object.entries(modules).reduce((acc, [path, module]) => {
//     if (!filters.includes(path)) {
//       const target = path.replace('./api/', '').replace('.ts', '')
//       const Api = module[target]
//       acc[target] = new Api(httpClient)
//     }
//     return acc
//   }, {} as Record<string, any>)

//   return [httpClient, apiObj] as const
// }
