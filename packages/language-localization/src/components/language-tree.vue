<script setup lang="ts">
import type { TreeOption } from 'naive-ui'
import { flattenObject } from 'es-toolkit'
import { computed, h, ref, watch } from 'vue'

const sourceLangKey = 'en-US'
const sourceLang = ref<Record<string, string>>({})
const langMap = ref<Record<string, any>>({})

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

const sourceLangKeyLength = computed(() => Object.keys(sourceLang.value).length)

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
      const translateObject = Object.groupBy(Object.keys(sourceLang.value), (key) => {
        return body[key] ? 'translated' : 'untranslated'
      })
      acc[fileName] = {
        translated: translateObject.translated?.map((sourceKey) => {
          return {
            sourceKey,
            sourceValue: sourceLang.value[sourceKey],
            targetValue: body[sourceKey],
            targetKey: fileName,
          }
        }),
        untranslated: translateObject.untranslated?.map((sourceKey) => {
          return {
            sourceKey,
            sourceValue: sourceLang.value[sourceKey],
            targetKey: fileName,
          }
        }),
        progress: computed(() => {
          const isSourceLang = fileName === sourceLangKey
          if (isSourceLang) {
            return `${fileName} (源语言)`
          }
          const targetLength = Object.keys(langMap.value[fileName]).length
          return `${fileName} (进度${targetLength / sourceLangKeyLength.value * 100}%)`
        }),
      }
      return acc
    }, {})
  langMap.value = result
  console.log(result)
})

function handleSave() {
  console.log('targetValue changed: ', currentRow.value.targetValue)
  const currentLangMap = langMap.value[currentRow.value.targetKey]
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
}

defineExpose({
  handleSave,
})
</script>

<template>
  <el-tabs tab-position="left">
    <template v-for="(map, lang) in langMap" :key="lang">
      <el-tab-pane :label="map.progress">
        <el-tabs type="border-card">
          <template v-for="tranTabItem in translateTabs" :key="tranTabItem.key">
            <el-tab-pane :label="`${tranTabItem.label}(${map[tranTabItem.key]?.length || 0})`">
              <el-table
                :data="map[tranTabItem.key]"
                highlight-current-row
                style="width: 100%"
                @current-change="handleCurrentChange"
              >
                <el-table-column type="index" width="50" />
                <el-table-column property="sourceKey" label="key" />
                <el-table-column property="sourceValue" label="源语言" />
                <el-table-column property="targetValue" label="目标语言">
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
