import { injectLocal, provideLocal } from '@vueuse/core'

import type { Ref } from 'vue'

interface DynamicTableType {
  isBatch: Ref<boolean>
  createCount: Ref<number>
}

const key = Symbol('dynamic-table')

export function createTableContext(instance: DynamicTableType) {
  provideLocal(key, instance)
}

export function useTableContext() {
  return injectLocal(key) as DynamicTableType
}
