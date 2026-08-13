import type { Ref } from 'vue'
import { injectLocal, provideLocal } from '@vueuse/core'
import type { Driver } from 'driver.js'

interface DynamicTableType {
  isBatch: Ref<boolean>
  createCount: Ref<number>
  driverObj?: Ref<Driver | undefined>
  presetTemplate?: Ref<any>
  oneClickSettings?: Ref<any[]>
  /** 点击购买时关闭引导，返回是否处于第 1 步引导中 */
  pauseCreateGuide?: () => boolean
  /** 购买弹窗关闭后聚焦「创建窗口」(.guide2) */
  continueCreateGuideAfterBuy?: () => Promise<void>
}

const key = Symbol('dynamic-table')

export function createTableContext(instance: DynamicTableType) {
  provideLocal(key, instance)
}

export function useTableContext() {
  return injectLocal(key) as DynamicTableType
}
