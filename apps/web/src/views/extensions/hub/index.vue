<script setup lang="ts">
import Fuse from 'fuse.js'
import TsFormInputText from '/@/views/lab/components/form/m-input-text.vue'
import installExtension from '/@/views/extensions/install/components/install-extension.vue'
import { RxSvgIcon } from '/@/components/rx-icon/'
import { useDebounceFn } from '@vueuse/core'
import { useDialog } from 'primevue/usedialog'
import { API } from '/@/api'
import { useResponseToast } from '/@/hooks/useResponseToast'
import type { UnwrapRowType, UserGetPluginCategoryListData, UserGetSystemPluginListData } from '@roxy/backend-api'

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

const categories = ref<CategoryItem[]>([])
const activeCategory = ref()
const pluginList = ref()
const fuse = ref()
const search = ref('')
const searchResult = ref()
const isInit = ref(false)
const loading = ref(false)
const extensionList = computed(() => search.value ? searchResult.value : pluginList.value)

const listContainerRef = useTemplateRef<any>('listContainer')
const observer = ref<IntersectionObserver>()
/**
 * 点击导航滚动标记
 */
const isNavScrolling = ref(false)

const searchPlugins = useDebounceFn(() => {
  const list = fuse.value?.search(search.value).map((res: any) => toRaw(res.item))
  searchResult.value = formatPluginList(list)
}, 200)

function formatPluginList(list: PluginItem[]) {
  return Object.values(list.reduce((map: PluginMap, item) => {
    item.categoryName = categories.value.find(n => n.id === item.category)?.categoryName || item.categoryName
    map[item.categoryName] ??= {
      categoryId: item.category,
      categoryName: item.categoryName,
      items: [],
    }
    map[item.categoryName]!.items.push(item)
    return map
  }, {}))
}

function setupIntersectionObserver() {
  if (!listContainerRef.value)
    return

  cleanupObserver()

  observer.value = new IntersectionObserver(
    (entries) => {
      if (isNavScrolling.value)
        return

      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const categoryId = Number.parseInt(entry.target.id.replace('category_', ''))
          activeCategory.value = categoryId
        }
      })
    },
    {
      root: listContainerRef.value,
      rootMargin: '-20% 0px -70% 0px', // 触发区域
      threshold: 0,
    },
  )

  /**
   * 添加滚动监听来处理边界情况
   */
  const handleScroll = () => {
    if (isNavScrolling.value)
      return

    const container = listContainerRef.value
    if (!container)
      return

    const scrollTop = container.scrollTop

    // 如果滚动到顶部，高亮第一个分类
    if (scrollTop <= 0 && categories.value.length > 0) {
      activeCategory.value = categories.value[0]!.id
      return
    }

    // 如果滚动到底部，高亮最后一个分类
    const scrollHeight = container.scrollHeight
    const clientHeight = container.clientHeight
    if (scrollTop + clientHeight >= scrollHeight - 10 && categories.value.length > 0) {
      activeCategory.value = categories.value.at(-1)!.id
    }
  }

  // 添加滚动事件监听
  listContainerRef.value.addEventListener('scroll', handleScroll, { passive: true })

  // 保存handleScroll引用以便清理时使用
  listContainerRef.value._handleScroll = handleScroll

  nextTick(() => {
    const categoryElements = document.querySelectorAll('[id^="category_"]')
    categoryElements.forEach((element) => {
      observer.value?.observe(element)
    })
  })
}

function cleanupObserver() {
  if (observer.value) {
    observer.value.disconnect()
    observer.value = undefined
  }

  // 移除滚动事件监听器
  if (listContainerRef.value) {
    const handleScroll = listContainerRef.value._handleScroll
    if (handleScroll) {
      listContainerRef.value.removeEventListener('scroll', handleScroll)
      delete listContainerRef.value._handleScroll
    }
  }
}

async function getRecommendPluginList() {
  if (isInit.value)
    return
  isInit.value = true
  loading.value = true
  await getCategoryList()
  await getPluginList()
  loading.value = false
  nextTick(() => {
    setupIntersectionObserver()
  })
}

async function getCategoryList() {
  const { data } = await API.plugins.userGetPluginCategoryList()
  categories.value = data.rows
  activeCategory.value = data.rows[0]!.id
}

async function getPluginList() {
  const { data } = await API.plugins.userGetSystemPluginList({})
  pluginList.value = formatPluginList(data.rows)

  fuse.value = new Fuse(data.rows, {
    threshold: 0.3,
    keys: ['pluginName'],
  })
}

function jumpToCategory(item: CategoryItem) {
  activeCategory.value = item.id
  isNavScrolling.value = true

  const targetElement = document.getElementById(`category_${item.id}`)
  if (targetElement) {
    targetElement.scrollIntoView({ behavior: 'smooth' })

    // 使用更可靠的滚动完成检测
    let lastScrollTop = 0
    let scrollEndTimer: NodeJS.Timeout | null = null

    const checkScrollComplete = () => {
      const container = listContainerRef.value
      if (container) {
        const currentScrollTop = container.scrollTop

        if (scrollEndTimer) {
          clearTimeout(scrollEndTimer)
        }

        // 如果滚动位置没有变化，设置定时器等待滚动真正结束
        if (currentScrollTop === lastScrollTop) {
          scrollEndTimer = setTimeout(() => {
            isNavScrolling.value = false
          }, 150) // 等待滚动动画完全结束
        }
        else {
          lastScrollTop = currentScrollTop
          requestAnimationFrame(checkScrollComplete)
        }
      }
    }

    // 延迟开始检测，等待滚动动画开始
    setTimeout(() => {
      checkScrollComplete()
    }, 50)
  }
  else {
    // 如果找不到目标元素，直接重置标记
    setTimeout(() => {
      isNavScrolling.value = false
    }, 500)
  }
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
          // 下载并校验插件 sha512 值
          const [result] = await globalThis.electronAPI.send('extension:download', [toRaw(plugin)])
          console.log('extension:download', result)
          if (result?.status === 'rejected' && result.reason?.message) {
            return showToast(-1, result.reason.message)
          }

          const { code, data, msg } = await API.plugins.userAddSystemPluginCreate({ id: plugin.id })
          onlyErrorToast(code, msg)
          if (code === 0) {
            plugin.addStatus = true
            needsync.value = true
            const { code, msg } = await API.plugins.userAddPluginToWindowCreate({ ...params, pluginId: data.plugin_id })
            onlyErrorToast(code, msg)
          }
        }
        catch (error) {
          onlyErrorToast(-1, error as string)
        }
      },
    },
  })
}

onUnmounted(() => {
  cleanupObserver()
})

defineExpose({
  getRecommendPluginList,
  refresh: () => {
    search.value = ''
    searchResult.value = undefined
    getPluginList()
    nextTick(() => {
      setupIntersectionObserver()
    })
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
        <TsFormInputText v-model="search" :placeholder="$t('搜索您的常用扩展')" @input="searchPlugins" />
      </InputGroup>
      <div ref="listContainer" class="relative flex-1 overflow-y-auto list-container dynamic-padding">
        <i18n-t v-if="search && !extensionList?.length" tag="div" class="h-full flex items-center justify-center google" :keypath="$t('暂未找到相关扩展，请前往 {link} 查看更多扩展', { link: '{link}' })" scope="global">
          <template #link>
            <a href="https://chromewebstore.google.com" target="_blank" rel="noopener noreferrer">Google Store</a>
          </template>
        </i18n-t>
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
                  By <a class="decoration-underline" :href="`https://chromewebstore.google.com/detail/${plugin.pluginDir}`" target="_blank">{{ plugin.provider }}</a>
                </div>
                <RxButton v-if="plugin.addStatus" size="xxs" outlined severity="secondary" icon="base/rx_ic_check" :label="$t('已下载')" disabled />
                <RxButton v-else size="xxs" outlined severity="secondary" icon="base/rx_ic_download_cloud" :label="$t('下载')" @click="onInstall(plugin)" />
              </div>
            </div>
          </div>
        </div>
        <RxLoading v-model="loading" :opacity="0.8" />
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
      background: var(--primitives-blue-100, #e8f5fc);
    }

    &-item {
      position: relative;
      padding-left: var(--spacing-2xl, 16px);
      color: var(--colors-text-text-secondary, #b2b6b8);
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
        background: var(--colors-icon-icon-brand, #12a3fc);
        transition: all 0.2s linear;
      }

      &.active {
        color: var(--colors-text-text-primary, #fafafa);
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
      color: var(--colors-text-text-tertiary, #575d60);
      font-family: Inter;
      font-size: 12px;
      font-style: normal;
      font-weight: 600;
      line-height: var(--Line-Height-text-xs, 16px);
      text-transform: uppercase;
    }

    &-content {
      display: grid;
      grid-template-columns: repeat(1, 1fr);
      gap: 24px var(--spacing-4xl, 24px);
      margin-top: var(--spacing-lg, 8px);
    }
  }
}

.google {
  color: var(--colors-text-text-primary);
  font-size: 14px;
}

@media (min-width: 768px) {
  .list-group-content {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (min-width: 1400px) {
  .list-group-content {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (min-width: 1920px) {
  .list-group-content {
    grid-template-columns: repeat(4, 1fr);
  }
}

@media (min-width: 9999px) {
  .list-group-content {
    grid-template-columns: repeat(5, 1fr);
  }
}

.extension {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xl, 12px);
  padding: var(--spacing-xl, 12px);
  min-height: 204px;
  border-radius: var(--radius-md, 6px);
  border: 0.5px solid var(--colors-border-border-overlay, #c7cdd1);
  background: var(--colors-background-bg-overlay);
  box-shadow:
    0px 4px 4px -1px rgba(0, 0, 0, 0.02),
    0px 1px 1px 0px rgba(0, 0, 0, 0.06);

  &-image {
    padding: 8px;
    width: 56px;
    aspect-ratio: 1;
    border-radius: var(--Component-Colors-TextInput-radius-radius-sm, 4px);
    border: 0.5px solid var(--colors-border-border-subtle, #c7cdd1);
    background: var(--colors-background-bg-block, #fff);
  }

  &-name {
    margin-top: var(--spacing-lg, 8px);
    color: var(--colors-text-text-primary, #fafafa);
    font-family: Inter;
    font-size: 13px;
    font-weight: 500;
    line-height: var(--Line-Height-text-xs, 16px);
  }

  &-version {
    margin-top: var(--spacing-sm, 4px);
    color: var(--colors-text-text-tertiary, #575d60);
    font-family: Inter;
    font-size: 12px;
    line-height: var(--Line-Height-text-xs, 16px);
  }

  &-description {
    display: -webkit-box;
    -webkit-box-orient: vertical;
    overflow: hidden;
    text-overflow: ellipsis;
    color: var(--colors-text-text-secondary, #b2b6b8);
    font-family: Inter;
    font-size: 12px;
    line-height: 16px;
  }

  &-provider {
    color: var(--colors-text-text-tertiary, #575d60);
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
