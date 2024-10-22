/** 是否处于开发环境 */
export const isDev = import.meta.env.DEV
/** 是否处于生产环境 */
export const isProd = import.meta.env.PROD

console.log('isDev', isDev)
console.log('isProd', isProd)
