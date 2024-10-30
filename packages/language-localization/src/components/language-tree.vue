<script setup lang="ts">
import { computed, ref } from 'vue'
import AddDialog from './add-dialog.vue'
import { ISO639, sourceLangKey } from './ISO-639'

const emit = defineEmits(['langListChange'])

const activeLang = ref(sourceLangKey)
const activeTranTab = ref('untranslated')
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

function getLangs() {
  // const chineseRegex = /[\u4E00-\u9FA5]/g
  fetch('./api/getLangs').then(res => res.json()).then((data) => {
    console.log('/api/getLangs', data)
    const result = data
    // .map((item) => {
    //   return [item.fileName, item.body]
    // })
      .reduce((acc, item) => {
        const { translated = [], untranslated = [] } = Object.groupBy(Object.entries<string>(item.body), ([key, value]) => {
          return value ? 'translated' : 'untranslated'
        })

        const { fileName } = item
        const langItem = ISO639.find(n => n.code === fileName)

        acc.push({
          ISO639: langItem,
          fileName,
          translated: translated.map(([key, value]) => {
            return {
              key,
              value,
              fileName,
              sourceLang: sourceLangKey,
              targetLang: fileName,
              // position: item.keysPositionMap[key],
            }
          }),
          untranslated: untranslated.map(([key, value]) => {
            return {
              key,
              value,
              fileName,
              sourceLang: sourceLangKey,
              targetLang: fileName,
              // position: item.keysPositionMap[key],
            }
          }),
          label: `${langItem?.icon}${langItem?.lang}(${fileName})`,
          progress: computed(() => {
            const isSourceLang = fileName === sourceLangKey
            if (isSourceLang) {
              return 100
            }
            const { translated = [], untranslated = [] } = langList.value.find(n => n.fileName === fileName)!
            return Math.ceil(translated?.length / (untranslated.length + translated?.length) * 100)
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
    console.log('langList', langList.value)
  })
}

getLangs()

function handleSave() {
  console.log('targetValue changed: ', currentRow.value.value)
  const currentLangMap = langList.value.find(n => n.fileName === currentRow.value.fileName)!
  const untranslatedIndex = currentLangMap.untranslated?.findIndex(item => item.key === currentRow.value.key)
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
  const isSourceLangChange = currentRow.value.fileName === sourceLangKey

  if (isSourceLangChange) {
    currentRow.value.key = currentRow.value.value
  }

  isSourceLangChange && getLangs()
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
        <el-tabs v-model="activeTranTab" type="border-card">
          <template v-for="tranTabItem in translateTabs" :key="tranTabItem.key">
            <el-tab-pane :label="`${tranTabItem.label}(${langItem[tranTabItem.key]?.length || 0})`" :name="tranTabItem.key">
              <el-table
                :data="langItem[tranTabItem.key]"
                highlight-current-row
                style="width: 100%"
                max-height="calc(100vh - 200px)"
                @current-change="handleCurrentChange"
              >
                <el-table-column type="index" width="50" />
                <!-- <el-table-column property="position" label="位置" /> -->
                <el-table-column property="key" :label="`源语言(${sourceLangKey})`" />
                <el-table-column v-if="activeTranTab === 'translated'" property="value" :label="langItem.ISO639.lang">
                  <template #default="{ row }">
                    {{ row.value }}
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
