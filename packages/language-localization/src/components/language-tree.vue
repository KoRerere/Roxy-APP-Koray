<script setup lang="ts">
import { flattenObject } from 'es-toolkit'
import { computed, ref } from 'vue'
import AddDialog from './add-dialog.vue'

const sourceLangKey = 'en-US'
const activeLang = ref('en-US')
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
      const { translated = [], untranslated = [] } = Object.groupBy(Object.keys(sourceLang.value), (key) => {
        return body[key] ? 'translated' : 'untranslated'
      })
      acc[fileName] = {
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
        progress: computed(() => {
          const isSourceLang = fileName === sourceLangKey
          if (isSourceLang) {
            return `${fileName} (源语言)`
          }
          const translatedLength = Object.keys(langMap.value[fileName].translated).length
          return `${fileName} (进度${Math.ceil(translatedLength / Object.keys(sourceLang.value).length * 100)}%)`
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
    <template v-for="(map, lang) in langMap" :key="lang">
      <el-tab-pane :label="map.progress" :name="lang">
        <AddDialog v-if="currentRow.targetKey === sourceLangKey" class="mb-[12px]" />
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
