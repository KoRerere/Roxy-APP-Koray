<!--
  历史记录对话框组件

  显示用户的所有会话列表，允许切换会话。
-->
<script setup lang="ts">
interface Session {
  sessionId: string
  config?: any
  createdAt?: string
  lastUpdated?: string
}

defineProps<{
  /** 是否显示对话框 */
  visible: boolean
  /** 会话列表 */
  sessions: Session[]
  /** 当前会话 ID */
  currentSessionId?: string | null
}>()

defineEmits<{
  /** 关闭对话框 */
  close: () => void
  /** 切换会话 */
  switchSession: [sessionId: string]
}>()

/**
 * 格式化时间显示
 */
function formatTime(timeString: string): string {
  try {
    const date = new Date(timeString)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))

    if (days === 0) {
      // 今天：显示时间
      return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    }
    else if (days === 1) {
      return '昨天'
    }
    else if (days < 7) {
      return `${days}天前`
    }
    else {
      // 超过7天：显示日期
      return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
    }
  }
  catch {
    return ''
  }
}
</script>

<template>
  <Teleport to="body">
    <div v-if="visible" class="dialog-overlay" @click="$emit('close')">
      <div class="dialog-content sessions-dialog" @click.stop>
        <h3>会话列表</h3>
        <div v-if="sessions && sessions.length > 0" class="sessions-list">
          <div
            v-for="session in sessions"
            :key="session.sessionId"
            class="session-item"
            :class="{ active: session.sessionId === currentSessionId }"
            @click="$emit('switchSession', session.sessionId)"
          >
            <div class="session-info">
              <div class="session-main">
                <div class="session-id">
                  {{ session.sessionId.substring(0, 16) }}...
                </div>
                <div v-if="session.lastUpdated" class="session-time">
                  {{ formatTime(session.lastUpdated) }}
                </div>
              </div>
            </div>
          </div>
        </div>
        <div v-else class="empty-sessions">
          暂无会话
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

.sessions-dialog {
  min-width: 500px;
  max-width: 600px;
}

.sessions-list {
  max-height: 400px;
  overflow-y: auto;
  margin-bottom: 24px;
}

.session-item {
  padding: 12px;
  margin: 8px 0;
  background: #f8f9fa;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  border: 2px solid transparent;

  &:hover {
    background: #e9ecef;
    border-color: #1971c2;
  }

  &.active {
    background: #e7f5ff;
    border-color: #1971c2;
  }
}

.session-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.session-main {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
}

.session-id {
  font-family: monospace;
  font-size: 13px;
  color: #495057;
  font-weight: 500;
}

.session-time {
  font-size: 11px;
  color: #6c757d;
}

.session-badge {
  padding: 2px 8px;
  background: #1971c2;
  color: white;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 500;
}

.empty-sessions {
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
