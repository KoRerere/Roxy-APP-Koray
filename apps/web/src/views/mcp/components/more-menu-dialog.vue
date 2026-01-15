<!--
  更多菜单对话框组件

  显示应用配置选项，包括：
  - 清空会话按钮（有消息时显示）
-->
<script setup lang="ts">
defineProps<{
  /** 是否显示对话框 */
  visible: boolean
  /** 是否有消息（用于决定是否显示清空会话按钮） */
  hasMessages: boolean
}>()

const emit = defineEmits<{
  /** 关闭对话框 */
  'close': () => void
  /** 清空会话 */
  'clearSession': () => void
}>()
</script>

<template>
  <Teleport to="body">
    <div v-if="visible" class="dialog-overlay" @click="$emit('close')">
      <div class="dialog-content more-menu-dialog" @click.stop>
        <h3>更多选项</h3>
        <div class="more-menu-options">
          <div v-if="hasMessages" class="menu-option">
            <button class="menu-action-btn clear-btn" @click="$emit('clearSession')">
              清空会话
            </button>
          </div>
          <div v-else class="empty-options">
            <p>暂无可用选项</p>
          </div>
        </div>
        <div class="dialog-actions">
          <button class="btn-cancel" @click="$emit('close')">
            关闭
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style lang="scss" scoped>
.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.dialog-content {
  background: white;
  border-radius: 8px;
  padding: 24px;
  min-width: 400px;
  max-width: 500px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);

  h3 {
    margin: 0 0 12px 0;
    font-size: 18px;
    color: #212529;
  }
}

.more-menu-dialog {
  min-width: 350px;
}

.more-menu-options {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-bottom: 24px;
}

.menu-option {
  display: flex;
  align-items: center;
  gap: 12px;

  label {
    font-size: 14px;
    font-weight: 500;
    color: #495057;
    min-width: 80px;
  }
}

.menu-checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  min-width: auto;
}

.menu-action-btn {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
  background: #ff6b6b;
  color: white;

  &:hover {
    background: #ee5a5a;
  }

  &.clear-btn {
    width: 100%;
  }
}

.empty-options {
  padding: 24px;
  text-align: center;
  color: #6c757d;
  font-size: 14px;
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.btn-cancel {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
  background: #e9ecef;
  color: #495057;

  &:hover {
    background: #dee2e6;
  }
}
</style>
