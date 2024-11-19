<script setup lang="ts">
import type { UnwrapRowType, UserGetPluginCategoryListData, UserGetSystemPluginListData } from '@roxy/backend-api'
import { useDebounceFn } from '@vueuse/core'
import Fuse from 'fuse.js'
import { useDialog } from 'primevue/usedialog'
import { API } from '/@/api'
import { RxSvgIcon } from '/@/components/rx-icon/'
import { useResponseToast } from '/@/hooks/useResponseToast'
import installExtension from '/@/views/extensions/install/components/install-extension.vue'

type CategoryItem = UnwrapRowType<UserGetPluginCategoryListData>
type PluginItem = UnwrapRowType<UserGetSystemPluginListData>
interface PluginMap {
  [key: string]: {
    categoryId: number
    categoryName: string
    items: PluginItem[]
  }
}
const [showToast, onlyErrorToast] = useResponseToast()
const dialog = useDialog()

const needsync = defineModel('needsync')

const categories = ref()
const activeCategory = ref()
const pluginList = ref()
const fuse = ref()
const search = ref('')
const searchResult = ref()

const extensionList = computed(() => searchResult.value?.length > 0 ? searchResult.value : pluginList.value)

async function getCategoryList() {
  const { data } = await API.plugins.userGetPluginCategoryList()
  categories.value = data.rows
  activeCategory.value = data.rows[0].id
}

async function getPluginList() {
  const { data } = await API.plugins.userGetSystemPluginList({})
  pluginList.value = formatPluginList(data.rows)

  fuse.value = new Fuse(data.rows, {
    threshold: 0.3,
    keys: ['pluginName'],
  })
}

const searchPlugins = useDebounceFn(() => {
  const list = fuse.value?.search(search.value).map((res: any) => toRaw(res.item))
  searchResult.value = formatPluginList(list)
}, 700)

function formatPluginList(list: PluginItem[]) {
  return Object.values(list.reduce((map: PluginMap, item) => {
    (map[item.categoryName] || (map[item.categoryName] = {
      categoryId: item.category,
      categoryName: item.categoryName,
      items: [],
    })).items.push(item)
    return map
  }, {}))
}

function jumpToCategory(item: CategoryItem) {
  activeCategory.value = item.id
  document.getElementById(`category_${item.id}`)?.scrollIntoView({ behavior: 'smooth' })
}

async function onInstall(plugin: PluginItem) {
  dialog.open(installExtension, {
    props: {
      showHeader: false,
      modal: true,
      blockScroll: true,
    },
    data: {
      props: {
        ...plugin,
        required: true,
      },
      onConfirm: async (params: any) => {
        try {
          const { data } = await API.plugins.userAddSystemPluginCreate({ id: plugin.id })
          plugin.addStatus = true
          needsync.value = true

          const { code, msg } = await API.plugins.userAddPluginToWindowCreate({ ...params, pluginId: data.plugin_id })
          if (code === 0) {
            window.electronAPI.send('extension:download', [toRaw(plugin)])
          }
          showToast(code, msg)
        }
        catch (error) {
          onlyErrorToast(-1, error as string)
        }
      },
    },
  })
}

onBeforeMount(() => {
  getCategoryList()
  getPluginList()
})

defineExpose({
  refresh: () => {
    search.value = ''
    searchResult.value = undefined
    getPluginList()
  },
})
</script>

<template>
  <div class="flex flex-1 justify-between flex-row-reverse hub">
    <div>
      <div class="hub-categories">
        <div v-for="item in categories" :key="item.id" class="cursor-pointer hub-categories-item" :class="{ active: item.id === activeCategory }" @click="jumpToCategory(item)">
          {{ item.categoryName }}
        </div>
      </div>
    </div>
    <div class="flex flex-1 flex-col list">
      <InputGroup class="dynamic-padding">
        <InputGroupAddon>
          <RxSvgIcon name="base/rx_ic_magnify" />
        </InputGroupAddon>
        <InputText v-model="search" :placeholder="$t('搜索您的常用扩展')" @input="searchPlugins" />
      </InputGroup>
      <div class="flex-1 overflow-y-auto list-container dynamic-padding">
        <div v-for="item in extensionList" :key="item.categoryId" class="list-group">
          <div :id="`category_${item.categoryId}`" class="list-group-title">
            {{ item.categoryName }}
          </div>
          <div class="list-group-content">
            <div v-for="plugin in item.items" :key="plugin.id" class="extension">
              <div class="flex flex-col">
                <img class="extension-image" :src="plugin.pluginIcon">
                <div class="extension-name">
                  {{ plugin.pluginName }}
                </div>
                <div class="extension-version">
                  v{{ plugin.pluginVersion }}
                </div>
              </div>
              <div class="flex-1 extension-description">
                {{ plugin.pluginDesc }}
              </div>
              <div class="flex items-center justify-between extension-provider">
                <div>
                  By <span class="decoration-underline">{{ plugin.provider }}</span>
                </div>
                <RxButton v-if="plugin.addStatus" size="xxs" outlined severity="secondary" icon="base/rx_ic_check_line" :label="$t('已下载')" disabled />
                <RxButton v-else size="xxs" outlined severity="secondary" icon="base/rx_ic_download_cloud" :label="$t('下载')" @click="onInstall(plugin)" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.hub {
  padding: var(--spacing-4xl, 24px) var(--spacing-4xl, 24px) 0;

  &-categories {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xl, 12px);
    width: 126px;
    // width: calc(100% / 8 + 8px);

    &::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      width: 2px;
      height: 100%;
      border-radius: var(--Component-Colors-TextInput-radius-radius-lg, 8px);
      background: var(--Color-blue-100, #e8f5fc);
    }

    &-item {
      position: relative;
      padding-left: var(--spacing-2xl, 16px);
      color: var(--Colors-Text-text-secondary, #575d61);
      font-family: Inter;
      font-size: 12px;
      line-height: 16px;

      &::after {
        content: '';
        position: absolute;
        left: 0;
        top: 50%;
        transform: translateY(-50%) scaleY(0);
        width: 2px;
        height: 16px;
        border-radius: var(--Component-Colors-TextInput-radius-radius-sm, 4px);
        background: var(--Colors-Icon-icon-brand, #12a3fc);
        transition: all 0.2s linear;
      }

      &.active {
        color: var(--Colors-Text-text-primary, #171c1f);
        font-weight: 500;

        &::after {
          content: '';
          transform: translateY(-50%) scaleY(1);
        }
      }
    }
  }
}

.list {
  gap: 40px;

  &-container {
    &::-webkit-scrollbar {
      display: none;
    }
  }

  &-group {
    margin-top: 40px;

    &:first-of-type {
      margin-top: 0;
    }

    &-title {
      color: var(--Colors-Text-text-tertiary, #7c8387);
      font-family: Inter;
      font-size: 12px;
      font-style: normal;
      font-weight: 600;
      line-height: var(--Line-Height-text-xs, 16px);
      text-transform: uppercase;
    }

    &-content {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 24px var(--spacing-4xl, 24px);
      margin-top: var(--spacing-lg, 8px);
    }
  }
}

.extension {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xl, 12px);
  padding: var(--spacing-xl, 12px);
  min-height: 204px;
  border-radius: var(--radius-md, 6px);
  border: 0.5px solid var(--Colors-Border-border-container, #c7cdd1);
  background: var(--Color-neutrals-50, #fafbfc);
  box-shadow:
    0px 4px 4px -1px rgba(0, 0, 0, 0.02),
    0px 1px 1px 0px rgba(0, 0, 0, 0.06);

  &-image {
    padding: 8px;
    width: 56px;
    aspect-ratio: 1;
    border-radius: var(--Component-Colors-TextInput-radius-radius-sm, 4px);
    border: 0.5px solid var(--Colors-Border-border-container, #c7cdd1);
    background: var(--Colors-Background-bg-body, #fff);
  }

  &-name {
    margin-top: var(--spacing-lg, 8px);
    color: var(--Colors-Text-text-primary, #171c1f);
    font-family: Inter;
    font-size: 13px;
    font-weight: 500;
    line-height: var(--Line-Height-text-xs, 16px);
  }

  &-version {
    margin-top: var(--spacing-sm, 4px);
    color: var(--Colors-Text-text-tertiary, #7c8387);
    font-family: Inter;
    font-size: 12px;
    line-height: var(--Line-Height-text-xs, 16px);
  }

  &-description {
    display: -webkit-box;
    -webkit-box-orient: vertical;
    overflow: hidden;
    text-overflow: ellipsis;
    color: var(--Colors-Text-text-secondary, #575d61);
    font-family: Inter;
    font-size: 12px;
    line-height: 16px;
  }

  &-provider {
    color: var(--Colors-Text-text-tertiary, #7c8387);
    font-family: Inter;
    font-size: 12px;
    font-style: normal;
    font-weight: 400;
    line-height: var(--Line-Height-text-xs, 16px);
  }
}

.dynamic-padding {
  padding: 0 calc(100% / 24 + var(--spacing-2xl, 16px));
}
</style>
