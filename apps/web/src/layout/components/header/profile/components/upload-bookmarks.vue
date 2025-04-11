<script setup lang="ts">
import Dialog from 'primevue/dialog';
import { $t } from '/@/locales';
import { useToast } from 'primevue/usetoast';

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

// 显示书签只能上传500个url
class MaximumLimitExceeded extends Error {
  static MAX_BOOKMARK_COUNT = 500;
  constructor() {
    super($t('书签数量超过{count}，请检查文件格式是否正确', { count: MaximumLimitExceeded.MAX_BOOKMARK_COUNT }))
  }
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

watch(modelValue, (value) => {
  importMode.value = value.importMode || ImportMode.MERGE
}, { immediate: true })

const isEdit = computed(() => {
  const data = modelValue.value
  return data.bookmarkBar?.length > 0 || data.other?.length > 0
})

// primeVue的Tree组件字段
const renderTree = (tree: any, prefix = '') => {
  return tree.map((item: any, index: number) => {
    const key = prefix + item.name + index
    return {
      label: item.name,
      key: key,
      children: item.children ? renderTree(item.children, key) : [],
    }
  })
}

const tree = computed(() => {
  const data = modelValue.value || {};
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
      label: $t('与配置文件中的现有书签合并'),
      value: ImportMode.MERGE,
    },
    {
      label: $t('覆盖配置文件中的现有书签'),
      value: ImportMode.REPLACE,
    },
  ]
})

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
          url: a.href,
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
      children: parserBookmarksDt(dl?.children || [])
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
        description: 'HTML Files',
        accept: {
          'text/html': ['.html'],
        },
      },
    ],
    excludeAcceptAllOption: true, // 禁用所有文件类型选项
    multiple: false
  })

  const file = await fileHandle.getFile();
  const html = await file.text();
  const result = parseHtml(html)

  if (!result.bookmarkBar.length && !result.other.length) {
    throw new Error('没有解析到书签')
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
    modelValue.value = result
    emit('change', result)
    visible.value = true;
  } catch (error) {
    console.log('error', error)
    uploadError(error)
  }
}

const visible = ref(false)

// 点击编辑书签
function editBookmarks() {
  visible.value = true
}

async function reUploadBookmarks() {
  try {
    const result = await parseBookmarks()
    modelValue.value = result
  } catch (error) {
    console.log('error', error)
    uploadError(error)
  }
}

function saveBookmarks() {
  modelValue.value.importMode = importMode.value
  emit('change', modelValue.value)
  visible.value = false
}

function deleteBookmarks() {
  modelValue.value.bookmarkBar = []
  modelValue.value.other = []
  emit('change', modelValue.value)
}
</script>

<template>
  <div class="flex items-center gap-2">
    <template v-if="!isEdit">
      <RxButton severity="secondary" outlined :label="$t('上传文件')" icon="base/rx_ic_export" @click="uploadBookmarks" />
      <!-- <span class="upload-desc-text">
        {{ $t('* 仅支持 .html') }}
      </span> -->
    </template>
    <template v-else>
      <RxButton :label="$t('编辑')" severity="secondary" outlined icon="base/rx_ic_edit" @click="editBookmarks" />
    </template>
  </div>

  <!-- 允许点击遮罩关闭 -->
  <Dialog class="w-[640px]" v-model:visible="visible" :header="$t('编辑书签')" modal :draggable="false" dismissableMask>
    <div class="flex flex-col gap-4">
      <div>
        <div class="flex items-center gap-3">
          <RxButton severity="secondary" outlined :label="$t('上传文件')" icon="base/rx_ic_export"
            @click="reUploadBookmarks" />
          <span class="upload-file-name">{{ upLoadFileName }}</span>
        </div>
        <div class="mt-1 upload-desc-text">{{ $t('* 重新上传您的配置文件以更改书签。') }}</div>
      </div>
      <div class="tree-wrapper">
        <Tree v-model:expandedKeys="expandedKeys" :value="tree" class="w-full">
          <template #nodetoggleicon="{ node, expanded }">
            <SvgIcon v-if="expanded" name="base/rx_ic_folder_open" size="18" />
            <SvgIcon v-else name="base/rx_ic_folder_close" size="18" />
          </template>
          <template #nodeicon="{ node }">
            <SvgIcon v-if="node.type === 'url'" name="base/rx_ic_doc_line" size="18" />
          </template>
          <template #default="{ node }">
            <div v-if="node.type === 'folder'" class="bookmark-label">
              {{ node.label }}
            </div>
            <div v-else class="flex items-center gap-2">
              <span class="bookmark-label">{{ node.label }}</span>
              <span class="bookmark-url">{{ node.url }}</span>
            </div>
          </template>
        </Tree>
      </div>

      <div class="flex flex-col gap-2">
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
        <RxButton :label="$t('删除书签')" severity="secondary" outlined @click="deleteBookmarks"></RxButton>
        <RxButton :label="$t('保存书签')" severity="primary" @click="saveBookmarks" />
      </div>
    </template>
  </Dialog>
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
}

.bookmark-options-title {
  color: #000;
  font-size: 0.875rem;
  font-weight: 600;
}

.bookmark-label {
  color: var(--Colors-text-text-primary, #111213);
  font-size: 14px;
  font-weight: 400;
}

.bookmark-url {
  color: var(--Colors-text-text-tertiary, #575D60);
  font-size: 14px;
  font-weight: 400;
}
</style>
