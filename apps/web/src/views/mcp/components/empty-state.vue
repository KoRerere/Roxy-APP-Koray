<!--
  空状态组件

  当当前会话没有消息时显示默认内容。
-->
<script setup lang="ts">
</script>

<template>
  <div class="empty-state">
    <div class="empty-state-content">
      <div class="empty-state-icon">
        <span style="font-size: 48px;">💬</span>
      </div>
      <div class="empty-state-title">
        开始新的对话
      </div>
      <div class="empty-state-description">
        在下方输入框中输入您的问题，AI 助手将为您提供帮助
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  padding: 40px 20px;
  cursor: pointer;
  transition: opacity 0.2s;

  &:hover {
    opacity: 0.8;
  }
}

.empty-state-content {
  text-align: center;
  max-width: 400px;
}

.empty-state-icon {
  margin-bottom: 16px;
  opacity: 0.6;
}

.empty-state-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--colors-text-text-primary, #212529);
  margin-bottom: 8px;
}

.empty-state-description {
  font-size: 14px;
  color: var(--colors-text-text-secondary, #6c757d);
  line-height: 1.6;
}
</style>
