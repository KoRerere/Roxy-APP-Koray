<script setup lang="ts">
import { flattenObject } from 'es-toolkit'
import { computed, ref } from 'vue'
import AddDialog from './add-dialog.vue'
import { ISO639, sourceLangKey } from './ISO-639'

const emit = defineEmits(['langListChange'])

const activeLang = ref(sourceLangKey)
const sourceLang = ref<Record<string, string>>({})
const langList = ref<Record<string, any>[]>([])

const translateTabs = ref([
  {
    label: '未翻译',
    key: 'untranslated',
  },
  {
    label: '已翻译',
    key: 'translated',
  },
])

const currentRow = defineModel('currentRow', {
  type: Object,
  default: {},
})

function handleCurrentChange(val) {
  if (val) {
    currentRow.value = val
  }
}

fetch('./api/getLangs').then(res => res.json()).then((data) => {
  console.log(data)
  const result = data
    .map((item) => {
      if (item.fileName === sourceLangKey) {
        sourceLang.value = flattenObject(item.body)
      }
      return [item.fileName, flattenObject(item.body)]
    })
    .reduce((acc, [fileName, body]) => {
      const { translated = [], untranslated = [] } = Object.groupBy(Object.keys(sourceLang.value), (key) => {
        return body[key] ? 'translated' : 'untranslated'
      })

      const langItem = ISO639.find(n => n.code === fileName)

      acc.push({
        ISO639: langItem,
        fileName,
        translated: translated.map((sourceKey) => {
          return {
            sourceKey,
            sourceValue: sourceLang.value[sourceKey],
            targetValue: body[sourceKey],
            targetKey: fileName,
          }
        }),
        untranslated: untranslated.map((sourceKey) => {
          return {
            sourceKey,
            sourceValue: sourceLang.value[sourceKey],
            targetKey: fileName,
          }
        }),
        label: `${langItem?.icon}${langItem?.lang}(${fileName})`,
        progress: computed(() => {
          const isSourceLang = fileName === sourceLangKey
          if (isSourceLang) {
            return 100
          }
          const translatedLength = Object.keys(langList.value.find(n => n.fileName === fileName)?.translated).length
          return Math.ceil(translatedLength / Object.keys(sourceLang.value).length * 100)
        }),
      })
      return acc
    }, [])

  langList.value = result
  langList.value.sort((a, b) => {
    if (a.fileName === sourceLangKey) {
      return -1
    }
    if (b.fileName === sourceLangKey) {
      return 1
    }
    return a.progress - b.progress
  })
  emit('langListChange', langList.value)
  console.log(langList.value)
})

function handleSave() {
  console.log('targetValue changed: ', currentRow.value.targetValue)
  const currentLangMap = langList.value.find(n => n.fileName === currentRow.value.targetKey)!
  const untranslatedIndex = currentLangMap.untranslated?.findIndex(item => item.sourceKey === currentRow.value.sourceKey)
  if (untranslatedIndex > -1) {
    currentLangMap.untranslated.splice(untranslatedIndex, 1)
    currentLangMap.translated.unshift({
      isNew: true,
      ...currentRow.value,
    })
  }
  else {
    currentRow.value.hasChanged = true
  }
  fetch('./api/saveTranslate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      fileName: currentRow.value.targetKey,
      key: currentRow.value.sourceKey,
      value: currentRow.value.targetValue,
    }),
  })
  if (currentRow.value.targetKey === sourceLangKey) {
    currentRow.value.sourceValue = currentRow.value.targetValue
  }
}

defineExpose({
  handleSave,
})
</script>

<template>
  <el-tabs v-model="activeLang" tab-position="left">
    <template v-for="langItem in langList" :key="langItem.fileName">
      <el-tab-pane :name="langItem.fileName">
        <template #label>
          <div class="w-full flex gap-2 justify-between">
            <div>
              {{ langItem.label }}
            </div>
            <div class="w-[72px] flex justify-between">
              <template v-if="langItem.fileName === sourceLangKey">
                源语言
              </template>
              <template v-else>
                <span>进度:</span>
                <span>{{ langItem.progress }}%</span>
              </template>
            </div>
          </div>
        </template>
        <AddDialog v-if="activeLang === sourceLangKey" class="mb-[12px]" />
        <el-tabs type="border-card">
          <template v-for="tranTabItem in translateTabs" :key="tranTabItem.key">
            <el-tab-pane :label="`${tranTabItem.label}(${langItem[tranTabItem.key]?.length || 0})`">
              <el-table
                :data="langItem[tranTabItem.key]"
                highlight-current-row
                style="width: 100%"
                max-height="calc(100vh - 200px)"
                @current-change="handleCurrentChange"
              >
                <el-table-column type="index" width="50" />
                <el-table-column property="sourceKey" label="key" />
                <el-table-column property="sourceValue" label="源语言" />
                <el-table-column property="targetValue" :label="langItem.ISO639.lang">
                  <template #default="{ row }">
                    {{ row.targetValue }}
                    <el-tag v-if="row.isNew" type="success">
                      新
                    </el-tag>
                    <el-tag v-else-if="row.hasChanged" type="warning">
                      改
                    </el-tag>
                  </template>
                </el-table-column>
              </el-table>
            </el-tab-pane>
          </template>
        </el-tabs>
      </el-tab-pane>
    </template>
  </el-tabs>
</template>
