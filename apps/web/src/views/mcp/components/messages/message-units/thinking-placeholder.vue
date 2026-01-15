<!--
  思考占位符组件

  当消息还没有出现主题内容时显示 "Thinking ..."
  用于 Planning、Worker、Synthesis 等阶段

  Props:
    - 无（纯展示组件）
-->
<script setup lang="ts">
// 这是一个纯展示组件，不需要 props
</script>

<template>
  <div class="thinking-placeholder">
    <div class="thinking-placeholder-text">
      Thinking ...
    </div>
  </div>
</template>

<style lang="scss" scoped>
.thinking-placeholder {
  margin: 8px 0 12px;
  padding: 10px 12px;
  border-radius: 6px;
  background: rgba(255, 243, 205, 0.8);
  color: var(--colors-text-text-secondary, #6c757d);
  font-style: italic;
}

.thinking-placeholder-text {
  font-size: 14px;
  line-height: 1.6;
}
</style>

