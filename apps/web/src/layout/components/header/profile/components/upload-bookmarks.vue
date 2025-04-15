<script setup lang="ts">
import Dialog from 'primevue/dialog';
import { $t } from '/@/locales';
import { useToast } from 'primevue/usetoast';
import { MaximumLimitExceeded } from './settings-popup';
import { cloneDeep } from 'es-toolkit';

enum BookmarkType {
  FOLDER = 'folder',
  URL = 'url',
}

enum ImportMode {
  MERGE = 'merge',
  REPLACE = 'replace',
}

type BookmarkItem = {
  name: string
  url?: string
  type: BookmarkType
  children?: BookmarkItem[]
}

type BookText = {
  bookmarkBar: BookmarkItem[]
  other: BookmarkItem[]
  importMode: ImportMode
}

const emit = defineEmits(['change'])
const modelValue = defineModel<BookText>({
  default: {
    bookmarkBar: [],
    other: [],
    importMode: ImportMode.MERGE
  }
})
const importMode = ref<ImportMode>(ImportMode.MERGE)
const upLoadFileName = ref('')
const toast = useToast()
const expandedKeys = ref({});
const visible = ref(false)
const __modelValue = ref<BookText>({
  bookmarkBar: [],
  other: [],
  importMode: ImportMode.MERGE
})

watch([modelValue, visible], (values) => {
  importMode.value = modelValue.value.importMode || ImportMode.MERGE
  __modelValue.value = cloneDeep(modelValue.value);
}, { immediate: true })

// const isEdit = computed(() => {
//   const data = __modelValue.value
//   return data.bookmarkBar?.length > 0 || data.other?.length > 0
// })

// const isEmpty = computed(() => {
//   const data = __modelValue.value
//   return !data.bookmarkBar?.length && !data.other?.length
// })

// primeVue的Tree组件字段
const renderTree = (tree: any, prefix = '') => {
  return tree.map((item: any, index: number) => {
    const key = prefix + item.name + index
    return {
      label: item.name,
      key: key,
      type: item.type,
      url: item.url,
      children: item.children ? renderTree(item.children, key) : [],
    }
  })
}

const tree = computed(() => {
  const data = __modelValue.value || {};
  const bookmarkBar = renderTree(data.bookmarkBar || [], 'bookmarkBar');
  const other = renderTree(data.other || [], '__other__');
  if (other.length > 0) {
    bookmarkBar.push({
      label: $t('其他标签'),
      key: "__other__",
      children: other
    })
  }
  expandAll(bookmarkBar)
  return bookmarkBar
})

const expandAll = (tree) => {
  const __expandedKeys = {};
  for (let node of tree) {
    expandNode(node, __expandedKeys);
  }
  expandedKeys.value = __expandedKeys
};

const expandNode = (node, __expandedKeys) => {
  if (node.children && node.children.length) {
    __expandedKeys[node.key] = true;

    for (let child of node.children) {
      expandNode(child, __expandedKeys);
    }
  }
};

const bookmarkOptions = computed(() => {
  return [
    {
      label: $t('与窗口中已有书签合并'),
      value: ImportMode.MERGE,
    },
    {
      label: $t('覆盖原窗口中已有书签'),
      value: ImportMode.REPLACE,
    },
  ]
})

function convertFolder(nodes: BookmarkItem[]) {
  // name一样的话，就把children合并为一个即可
  const newNodes: BookmarkItem[] = []
  for (const node of nodes) {
    const item = newNodes.find(item => item.name == node.name);
    if (item) {
      item.children = [...(item.children || []), ...(node.children || [])]
    } else {
      newNodes.push(node)
    }
  }
  return newNodes
}

let bookmarkCount = 0;
function parserBookmarksDt(nodes: HTMLCollection) {
  return Array.from(nodes).map((item) => {
    if (item.localName === 'dt') {
      const children = Array.from(item.children)
      const dl = children.find(n => n.localName === 'dl')
      if (dl) {
        return parserBookmarksDl(children)
      }
      const a = children.find(n => n.localName === 'a')
      if (a) {
        if (bookmarkCount > MaximumLimitExceeded.MAX_BOOKMARK_COUNT) {
          throw new MaximumLimitExceeded()
        }
        bookmarkCount++;
        return {
          name: a.innerText,
          type: BookmarkType.URL,
          url: a.href
        }
      }
    }
  }).filter(item => item)
}

function parserBookmarksDl(nodes: HTMLCollection) {
  const children = Array.from(nodes)
  const title = children.find(n => n.localName === 'h3' || n.localName === 'h1') as HTMLDivElement
  const dl = children.find(n => n.localName === 'dl') as HTMLDivElement
  if (title) {
    const item: BookmarkItem = {
      name: title.innerText,
      type: BookmarkType.FOLDER,
      children: convertFolder(parserBookmarksDt(dl?.children || []))
    }
    return item
  }
}

function parseHtml(html: string): BookText {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')
  const bookmarks = parserBookmarksDl(doc.body.children)
  // 获取书签栏
  const bookmarkBar = bookmarks?.children?.[0]?.children || []
  // 除了一个书签栏，其他都属于其他书签
  const other = bookmarks?.children?.slice(1) || []
  return {
    bookmarkBar,
    other,
    importMode: importMode.value,
  }
}

// 是否立即上传
async function parseBookmarks() {
  bookmarkCount = 0;

  const [fileHandle] = await showOpenFilePicker({
    // 只限制html
    types: [
      {
        description: 'HTML Document',
        accept: {
          'application/x-extension-html': ['.html']
        },
      },
    ],
    excludeAcceptAllOption: true, // 禁用所有文件类型选项
    multiple: false
  })

  const file = await fileHandle.getFile();
  const html = await file.text();
  const result = parseHtml(html)
  upLoadFileName.value = file.name

  if (!result.bookmarkBar.length && !result.other.length) {
    throw new Error($t('没有解析到书签'))
  }

  return result
}

function uploadError(error) {
  console.error(error)
  if (error instanceof MaximumLimitExceeded) {
    return toast.add({ severity: 'error', summary: $t('上传失败'), detail: error.message })
  }
  // 当前用户打开文件管理器，没有选择文件就关闭了，这个时候会抛出 AbortError 错误，我们不需要对这个错误做任何提示
  if (error.name !== 'AbortError') {
    toast.add({ severity: 'error', summary: $t('上传失败'), detail: $t('上传失败，请检查文件格式是否正确') })
  }
}

async function uploadBookmarks() {
  try {
    const result = await parseBookmarks()
    __modelValue.value = result
    visible.value = true;
  } catch (error) {
    console.log('error', error)
    uploadError(error)
  }
}

// 点击编辑书签
function editBookmarks() {
  visible.value = true
}

// async function reUploadBookmarks() {
//   try {
//     const result = await parseBookmarks()
//     __modelValue.value = result
//   } catch (error) {
//     console.log('error', error)
//     uploadError(error)
//   }
// }

function saveBookmarks() {
  __modelValue.value.importMode = importMode.value
  modelValue.value = cloneDeep(__modelValue.value);
  emit('change', modelValue.value)
  visible.value = false
}

function deleteBookmarks() {
  __modelValue.value.bookmarkBar = []
  __modelValue.value.other = []
  upLoadFileName.value = ''
}

function cancelBookmarks() {
  __modelValue.value = cloneDeep(modelValue.value);
  visible.value = false
}
</script>

<template>
  <div class="flex items-center gap-2" v-bind="$attrs">
    <!-- <template v-if="!isEdit">
      <RxButton severity="secondary" outlined :label="$t('上传文件')" icon="base/rx_ic_export" @click="uploadBookmarks" />
      <span class="upload-desc-text">
        {{ $t('* 仅支持 .html') }}
      </span>
    </template> -->
    <RxButton :label="$t('编辑')" severity="secondary" outlined icon="base/rx_ic_edit" @click="editBookmarks" />
  </div>

  <!-- 允许点击遮罩关闭 -->
  <Dialog class="w-[640px]" v-model:visible="visible" :header="$t('自定义书签')" modal :draggable="false" dismissableMask>
    <div class="flex flex-col gap-5">
      <div>
        <div class="flex items-center gap-3">
          <RxButton severity="secondary" outlined :label="$t('上传文件')" icon="base/rx_ic_export"
            @click="uploadBookmarks" />
          <span class="upload-file-name">{{ upLoadFileName }}</span>
        </div>
        <div class="mt-1 upload-desc-text">{{ $t('上传您的书签文件（仅支持.html格式）') }}</div>
      </div>

      <div class="flex flex-col gap-2">
        <div class="bookmark-preview-title">{{ $t('书签预览') }}</div>
        <div class="tree-wrapper" v-if="tree.length">
          <Tree v-model:expandedKeys="expandedKeys" :value="tree" class="w-full">
            <template #nodetoggleicon="{ node, expanded }">
              <SvgIcon v-if="expanded" name="base/rx_ic_folder_open" size="18" />
              <SvgIcon v-else name="base/rx_ic_folder_close" size="18" />
            </template>
            <template #nodeicon="{ node }">
              <SvgIcon v-if="node.type === 'url'" name="base/rx_ic_link" size="18" />
            </template>
            <template #default="{ node }">
              <div v-if="node.type === 'folder'" class="bookmark-label">
                {{ node.label }}
              </div>
              <div v-else class="gap-2 ellipsis-1 w-full" :title="node.label + ' ' + node.url">
                <span class="bookmark-label url">{{ node.label }}</span>
                <span class="bookmark-url">{{ node.url }}</span>
              </div>
            </template>
          </Tree>
        </div>
        <div class="tree-wrapper flex !items-center justify-center !h-[160px]" v-else>
          <div class="flex flex-col items-center gap-3">
            <SvgIcon name="base/rx_ic_bookmarks" size="32" color="#AFB7BB" />
            {{ $t('没有书签') }}
          </div>
        </div>
      </div>
      

      <div class="flex flex-col gap-2" v-if="tree.length">
        <div class="bookmark-options-title">{{ $t('书签选项') }}</div>
        <div class="flex flex-col gap-4">
          <div v-for="bookmark in bookmarkOptions" class="flex items-center gap-2">
            <RadioButton v-model="importMode" :inputId="bookmark.value" name="dynamic" :value="bookmark.value" />
            <label :for="bookmark.value">{{ bookmark.label }}</label>
          </div>
        </div>
      </div>
    </div>
    <template #footer>
      <div class="w-full flex justify-between">
        <RxButton icon="base/rx_ic_bin_1" severity="secondary" outlined @click="deleteBookmarks"
          :style="{ visibility: tree.length > 0 ? 'visible' : 'hidden' }"></RxButton>
        <div class="flex items-center gap-2">
          <RxButton :label="$t('取消')" severity="secondary" outlined @click="cancelBookmarks" />
          <RxButton :label="$t('保存书签')" severity="primary" @click="saveBookmarks" />
        </div>
      </div>
    </template>
  </Dialog>

  <!-- <RyPopover ref="popover" dismissableMask>
    <div class="flex flex-col gap-4 p-3 w-[220px]">
      <div class="text-3 text-[#111213]">
        {{ $t('您确认要删除当前的自定义书签吗？') }}
      </div>

      <div class="w-full flex justify-end gap-[6px]">
        <RxButton :label="$t('取消')" severity="secondary" outlined @click="cancelDelete"></RxButton>
        <RxButton :label="$t('删除')" severity="danger" @click="deleteBookmarks" />
      </div>
    </div>
  </RyPopover> -->
</template>

<style lang="scss" scoped>
.upload-desc-text {
  color: var(--Colors-text-text-inactive, #7d8387);
  font-family: Inter;
  font-size: 12px;
  line-height: 20px;
}

.upload-file-name {
  color: var(--Colors-text-text-primary, #111213);
  font-family: Inter;
  font-size: 14px;
}

.tree-wrapper {
  height: 360px;
  padding: 16px 24px 24px 24px;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--spacing-4xl, 24px);
  align-self: stretch;
  border-radius: 8px;
  background: var(--Colors-background-bg-block, #F1F5F8);
  overflow-y: auto;

  :deep(.p-tree) {
    background: transparent !important;
    padding: 0 !important;
  }

  :deep(.p-tree-node-content) {
    padding-left: 0 !important;
  }

  :deep(.p-tree-node-label) {
    overflow: hidden;
    white-space: nowrap;
  }

  :deep(.p-tree-node-content) {
    overflow: hidden;
    white-space: nowrap;
    gap: 8px;
  }

  :deep(.p-tree-node-children) {
    border-left: 1px solid var(--Colors-border-border-subtle, #C7D1D6);
    margin-left: 12px;
    gap: 2px;
    padding-left: 20px;
  }

  :deep(.p-tree-node-leaf > .p-tree-node-content .p-tree-node-toggle-button) {
    display: none;
  }

  :deep(.p-tree-node-toggle-button) {
    color: var(--Colors-icon-icon-primary, #2C2E30);
  }
}

.bookmark-options-title, .bookmark-preview-title {
  color: #000;
  font-size: 14px;
  font-weight: 600;
}

.bookmark-label {
  color: var(--Colors-text-text-primary, #111213);
  font-size: 14px;
  font-weight: 400;
}

.bookmark-label.url {
  margin-right: 8px;
}

.bookmark-url {
  color: var(--Colors-text-text-tertiary, #575D60);
  font-size: 14px;
  font-weight: 400;
}
</style>
