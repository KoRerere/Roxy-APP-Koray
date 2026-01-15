<!--
  用户消息组件

  用于显示用户发送的消息
-->
<script setup lang="ts">
import RxAvatar from '/@/components/rx-avatar'
import type { Message } from '../../../types.js'
import MessageHeader from '../message-units/message-header.vue'

const props = defineProps<{
  message: Message
  avatar?: string
  avatarColor?: string
  userName?: string
}>()
</script>

<template>
  <div class="message-wrapper message-wrapper-user message-user-type">
    <div class="message-content">
      <div class="message-header-row">
        <div class="message-avatar">
          <RxAvatar
            :size="32"
            :font-size="14"
            :avatar="avatar"
            :name="userName?.slice(0, 2)"
            :color="avatarColor"
          />
        </div>
        <MessageHeader
          label="You"
          :timestamp="message.timestamp"
          align="right"
        />
      </div>
      <div class="message-bubble message-user-bubble">
        {{ message.content }}
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.message-wrapper {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}

.message-wrapper-user {
  flex-direction: row-reverse;
  justify-content: flex-start;
}

.message-content {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  min-width: 0;
  flex: 1;
}

.message-header-row {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-direction: row;
  justify-content: flex-end;
  margin-bottom: 8px;
}

.message-avatar {
  flex-shrink: 0;
}

.message-user-bubble {
  display: inline-block;
  padding: 10px 14px;
  border-radius: 8px;
  max-width: 100%;
  word-wrap: break-word;
  line-height: 1.5;
  background: #f1f3f5;
  color: #212529;
  font-size: 14px;
  text-align: left;
}
</style>
