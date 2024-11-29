import { store } from '/@/modules/store'

/**
 * 在各语言SDK中，ObjectKey、Key以及ObjectName是同一概念，均表示对Object执行相关操作时需要填写的Object名称。
 * 例如向某一存储空间上传Object时，ObjectKey表示上传的Object所在存储空间的完整名称，
 * 即包含文件后缀在内的完整路径，如填写为abc/efg/123.jpg。
 */

export const ossObject = {
  /** 用户数据目录 */
  // groupdata: 'groupdata',
  // /** 用户窗口数据目录 */
  // get userWindowDataDir() {
  //   const { mainId } = store.userInfo
  //   return `/${this.groupdata}/${mainId}/window`
  // },
  /** 用户插件目录 */
  get userPluginDataDir() {
    return `/groupdata/workspace/${store.workspaceId}/plugin`
  },
} as const
