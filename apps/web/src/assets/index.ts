export const assetModules = import.meta.glob('./**/*', {
  query: '?url',
  import: 'default',
  eager: true,
})

// console.log('assetModules', assetModules)

/** 获取图片地址 */
export const imagesModule = new Proxy({}, {
  get(target, key: string) {
    return assetModules[`./images/${key}`]
  },
})
