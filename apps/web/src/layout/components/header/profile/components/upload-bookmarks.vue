<script setup lang="ts">
const emit = defineEmits(['change', 'update:modelValue'])

defineModel<string>('modelValue')

function parserBookmarksDt(nodes) {
  return Array.from(nodes).map((item) => {
    if (item.localName === 'dt') {
      const children = Array.from(item.children)
      const dl = children.find(n => n.localName === 'dl')
      if (dl) {
        return parserBookmarksDl(children)
      }
      const a = children.find(n => n.localName === 'a')
      if (a) {
        return {
          name: a.innerText,
          type: 'url',
          url: a.href,
        }
      }
    }
  }).filter(item => item)
}

function parserBookmarksDl(nodes) {
  const children = Array.from(nodes)
  const title = children.find(n => n.localName === 'h3' || n.localName === 'h1')
  const dl = children.find(n => n.localName === 'dl')
  if (title) {
    const item: { children: any[], name?: string, type?: string } = { children: [] }
    item.name = title.innerText
    item.type = 'folder'
    item.children = parserBookmarksDt(dl.children)
    return item
  }
}

function parseHtml(html: string) {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')
  const bookmarks = parserBookmarksDl(doc.body.children)
  // 获取书签栏
  const bookmarkBar = bookmarks?.children?.filter(item => item?.type === 'folder')?.[0]?.children || []
  // 获取其他书签
  const other = bookmarks?.children?.filter(item => item?.type === 'url') || []
  return {
    bookmarkBar,
    other,
    importMode: 'merge',
  }
}

function fileToString(file: File) {
  // 把这个文件转成字符串，因为这里是一个html
  const reader = new FileReader()
  reader.onload = (e: any) => {
    const html = e.target.result
    const result = parseHtml(html)
    console.log('result', result)
    emit('update:modelValue', JSON.stringify(result))
    emit('change', result)
  }
  reader.readAsText(file)
}

function uploadBookmarks() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.html'
  input.onchange = (e: any) => {
    const file = e.target.files[0]
    fileToString(file)
  }
  input.click()
}
</script>

<template>
  <div class="flex items-center gap-2">
    <RxButton
      severity="secondary"
      outlined
      :label="$t('上传文件')"
      icon="base/rx_ic_export"
      @click="uploadBookmarks"
    />
    <span class="upload-desc-text">
      {{ $t('* 仅支持 .html') }}
    </span>
  </div>
</template>

<style lang="scss" scoped>
.upload-desc-text {
  color: var(--Colors-text-text-inactive, #7d8387);
  text-align: center;
  font-family: Inter;
  font-size: 12px;
}
</style>
