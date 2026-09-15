<script setup lang="ts">
interface Props {
  /** 备注正文，空值时展示添加图标 */
  remark?: string
  /** 是否展开备注正文，与表头眼睛图标同步 */
  extend?: boolean
}

defineProps<Props>()
</script>

<template>
  <!-- note-light 必须打在本组件 DOM 上：RxButton inheritAttrs:false，class 落到内部后 scoped 选择器匹配不到 -->
  <div class="inline-flex items-center gap-1 shrink-0" :class="{ 'note-light': remark }">
    <RxButton v-tooltip.top="{ value: remark, showDelay: 0 }" class="shrink-0" text severity="secondary" size="xxs"
              :icon="remark ? 'base/rx_ic_doc_fill' : 'base/rx_ic_doc_add'"
    />
    <div v-if="extend" :title="remark" class="whitespace-pre-wrap note-content">
      {{ remark }}
    </div>
  </div>
</template>

<style scoped>
.note-content {
  /* 按文案撑开，避免表格把列压到一字宽；超过 200px 再换行省略 */
  width: max-content;
  max-width: 200px;
  min-width: min(max-content, 200px);
  flex-shrink: 0;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  overflow: hidden;
  text-overflow: ellipsis;
  overflow-wrap: break-word;
  line-height: 1.4;
}

.note-light {
  :deep(svg) {
    color: var(--colors-text-text-brand) !important;
  }
}
</style>
