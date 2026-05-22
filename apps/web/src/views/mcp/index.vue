<script setup lang="ts">
import { getImage } from '/@/utils/basic'
import ChatView from './chat-view.vue'
import SettingsView from './settings-view.vue'
import { useAgentApi } from './agent-api'
import type { Conversation } from './agent-api'
import { useAgentStore } from '/@/stores/agent'
import { computed, nextTick, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useThemeStore } from '/@/stores/theme'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { genDriver } from '/@/utils'
import ScriptsView from './scripts-view.vue'
import { useChatStream } from './composables/useChatStream'

const themeStore = useThemeStore()
const route = useRoute()
const background = computed(() => themeStore.realTheme === 'dark'
  ? 'images/mcp/agent-background-dark.svg'
  : 'images/mcp/agent-background-light.svg')

// 视图模式
type ViewMode = 'chat' | 'settings' | 'scripts'
const viewMode = ref<ViewMode>('chat')
const [, onlyErrorToast] = useResponseToast()

// API
const { conversationList: fetchConversationList, conversationDelete } = useAgentApi()
const agentStore = useAgentStore()

// 聊天相关状态
const conversationList = ref<Conversation[]>([])
const activeConversationId = ref<string>('')
const loading = ref(false)
const deletePopoverRefs = ref<Record<string, any>>({})
const openDeleteIds = ref(new Set<string>())

// 为初始化的
const uninitialized = ref(true)

// SSE 流式逻辑提升到父级
const chatStream = useChatStream(
  () => activeConversationId.value,
  {
    onUpdateTitle(conversationId, title) {
      const conversation = conversationList.value.find(c => c.id === conversationId)
      if (conversation) {
        conversation.title = title
      }
    },
    onCreateConversation(data) {
      conversationList.value.unshift(data)
      activeConversationId.value = data.id
    },
  },
)

async function loadConversations(notSetFrist?: boolean) {
  loading.value = true
  try {
    const res = await fetchConversationList()
    if (res.code === 0) {
      conversationList.value = res.data || []
      if (conversationList.value.length > 0 && !notSetFrist) {
        activeConversationId.value = conversationList.value[0].id
      }
      else {
        activeConversationId.value = ''
      }
    }
  }
  catch (e) {
    console.error('Failed to load conversations:', e)
  }
  finally {
    loading.value = false
  }
}

function handleCreateConversation() {
  if (chatStream.isChatting.value)
    return onlyErrorToast(-1, $t('任务进行中，不可操作'))
  chatStream.resetChat()
  activeConversationId.value = ''
  chatStream.inputScene.value = 'automation'
  navigateTo('chat')
}

async function handleDeleteConversation(id: string) {
  deletePopoverRefs.value[id]?.hide()
  try {
    const res = await conversationDelete(id)
    if (res.code === 0) {
      await loadConversations()
    }
  }
  catch (e) {
    console.error('Failed to delete conversation:', e)
  }
}

function navigateTo(value: ViewMode) {
  viewMode.value = value
}

function selectConversation(id: string) {
  if (chatStream.isChatting.value)
    return onlyErrorToast(-1, $t('任务进行中，不可操作'))
  activeConversationId.value = id
  navigateTo('chat')
}

function selectSettings() {
  if (chatStream.isChatting.value)
    return onlyErrorToast(-1, $t('任务进行中，不可操作'))
  activeConversationId.value = ''
  navigateTo('settings')
}

function selectScripts() {
  if (chatStream.isChatting.value)
    return onlyErrorToast(-1, $t('任务进行中，不可操作'))
  activeConversationId.value = ''
  navigateTo('scripts')
}

function handleUseScript(script: any) {
  if (chatStream.isChatting.value)
    return onlyErrorToast(-1, $t('任务进行中，不可操作'))
  chatStream.resetChat()
  activeConversationId.value = ''
  navigateTo('chat')
  nextTick(() => {
    chatStream.userMessage.value = `创建一个窗口，然后执行 \`${script.name}\` 脚本`
    chatStream.pendingScript.value = script
  })
}

// 初始化
onMounted(async () => {
  const isAsset = route.query.scene === 'asset'
  if (isAsset) {
    chatStream.inputScene.value = 'asset'
  }
  await agentStore.initMcp()
  await loadConversations(true)
  uninitialized.value = false
  let _driverStatus = {}
  try {
    _driverStatus = JSON.parse(localStorage.getItem('driverStatus') || '{}')
  }
  catch (error) {

  }
  const driverObj = genDriver({
    steps: [
      {
        element: '#mcpAndSkills',
        popover: {
          description: $t('MCP 和 Skills 设置现已开放。'),
          side: 'top',
          align: 'center',
        },
      },
    ],
    onDestroyed: () => {
      localStorage.setItem('driverStatus', JSON.stringify({ ..._driverStatus, mcpAndSkills: true }))
    },
  })

  if (!_driverStatus.mcpAndSkills) {
    driverObj.drive()
  }
})

onUnmounted(() => {
  agentStore.stopHealthCheck()
})
</script>

<template>
  <div class="relative w-full h-screen flex gap-4">
    <div class="absolute w-full h-screen z-0" :style="{ background: `url(${background}) no-repeat 50% 50% / cover` }" />

    <div class="w-full h-screen p-4 flex gap-4 relative z-1">
      <!-- 左侧边栏 -->
      <div class="w-[168px] h-full flex flex-col justify-between">
        <div class="flex-1 min-h-0 flex flex-col gap-3">
          <!-- Logo -->
          <div class="flex items-center gap-2">
            <div class="size-8">
              <img alt="" class="w-full h-full" :src="getImage('mcp/agent_avatar.png')">
            </div>
            <div class="font-['Archivo'] font-semibold text-[var(--colors-text-text-primary)] text-lg">
              Roxy AI Agent
            </div>
          </div>

          <!-- New Conversation Button -->
          <div
            class="w-full h-9 flex items-center justify-center px-2 rounded-lg cursor-pointer bg-[var(--colors-background-bg-action)]"
            :style="{
              boxShadow: '0 4px 4px -1px rgba(0, 0, 0, 0.02), 0 1px 1px 0 rgba(0, 0, 0, 0.06)',
            }"
            @click="handleCreateConversation"
          >
            <div class="flex items-center gap-1.5">
              <SvgIcon name="roxy-agent/rx-ic-chat" size="16" color="var(--colors-icon-icon-primary)" />
              <div class="new font-500 text-14px text-[var(--colors-icon-icon-primary)]">
                {{ $t('新建对话') }}
              </div>
            </div>
          </div>

          <!-- Conversation List -->
          <div class="flex-1 min-h-0 flex flex-col gap-1.5 w-full">
            <div class="font-['Inter'] font-600 text-[var(--colors-text-text-secondary)] text-sm">
              {{ $t('对话列表') }}
            </div>
            <div class="flex flex-col gap-0.5 w-full flex-1 min-h-0 overflow-y-auto">
              <div v-for="item in conversationList" :key="item.id" class="w-full min-h-11 flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer menu-item"
                   :class="[
                     item.id === activeConversationId && viewMode === 'chat' ? 'bg-[var(--pattern-sidenav-bg-hover)]' : 'bg-transparent hover:bg-[var(--pattern-sidenav-bg-hover)]',
                     openDeleteIds.has(item.id) && 'del-open',
                   ]"
                   @click="selectConversation(item.id)"
              >
                <div v-tooltip.top="{ value: item.title, showDelay: 1000 }" class="font-['Inter'] font-500 text-[var(--colors-text-text-primary-hover)] text-14px truncate">
                  {{ item.title }}
                </div>

                <!-- Delete Button -->
                <button class="size-6 hidden items-center justify-center rounded bg-transparent outline-none border-none cursor-pointer del-btn" @click.stop="openDeleteIds.add(item.id); deletePopoverRefs[item.id]?.toggle($event)">
                  <SvgIcon name="base/rx_ic_bin_1" size="16" color="var(--colors-text-text-secondary)" />
                </button>
                <Popover :ref="el => deletePopoverRefs[item.id] = el" :pt="{ content: { class: '!p-2' } }" @click.stop @hide="openDeleteIds.delete(item.id)">
                  <div class="flex flex-col gap-1 p-1 min-w-[120px]">
                    <div class="text-3 text-[var(--colors-text-text-secondary)] py-1">
                      {{ $t('确认删除？') }}
                    </div>
                    <div class="flex items-center gap-1 px-1">
                      <button class="flex-1 py-1.5 rounded cursor-pointer border-none bg-[var(--colors-background-bg-block)] text-[var(--colors-text-text-primary)]" @click.stop="deletePopoverRefs[item.id]?.hide()">
                        {{ $t('取消') }}
                      </button>
                      <button class="flex-1 py-1.5 rounded cursor-pointer border-none bg-transparent text-[var(--colors-text-text-danger)] text-3 hover:(bg-[var(--colors-text-text-error)] text-white)" @click.stop="handleDeleteConversation(item.id)">
                        {{ $t('删除') }}
                      </button>
                    </div>
                  </div>
                </Popover>
              </div>
              <div v-if="loading" class="text-center text-sm text-gray-500 py-2">
                Loading...
              </div>
              <div v-else-if="conversationList.length === 0" class="text-center text-sm text-gray-500 py-2">
                {{ $t('暂无对话记录') }}
              </div>
            </div>
          </div>
        </div>

        <!-- Bottom Section -->
        <div class="flex flex-col gap-1 w-full pt-1">
          <!-- <div id="scripts" class="flex items-center gap-1.5 h-9 px-3 rounded-lg cursor-pointer text-[var(--colors-text-text-primary-hover)]"
               :class="viewMode === 'scripts' ? 'bg-[var(--pattern-sidenav-bg-hover)]' : ''" @click="selectScripts"
          >
            <SvgIcon name="base/rx_ic_doc_code" size="16" color="var(--colors-icon-icon-primary-hover)" />
            <div class="font-['Inter'] font-medium text-sm">
              Scripts
            </div>
          </div> -->
          <div id="mcpAndSkills" class="flex items-center gap-1.5 h-9 px-3 rounded-lg cursor-pointer text-[var(--colors-text-text-primary-hover)]"
               :class="viewMode === 'settings' ? 'bg-[var(--pattern-sidenav-bg-hover)]' : ''" @click="selectSettings"
          >
            <SvgIcon name="base/rx_ic_mcp" size="16" color="var(--colors-icon-icon-primary-hover)" />
            <div class="font-['Inter'] font-medium text-sm">
              MCP & Skills
            </div>
          </div>
        </div>
      </div>

      <!-- 主内容区 -->
      <div class="relative flex-1 w-full h-full bg-[var(--colors-background-bg-page)] rounded-4 overflow-hidden">
        <ChatView v-if="viewMode === 'chat'" :message-list="chatStream.messageList.value" :is-chatting="chatStream.isChatting.value" :todo="chatStream.todo.value"
                  :pending-attachments="chatStream.pendingAttachments.value" :pending-script="chatStream.pendingScript.value" :current-conversation="chatStream.currentConversation.value"
                  :is-empty="chatStream.isEmpty.value" :uninitialized="uninitialized" :user-message="chatStream.userMessage.value" :mode="chatStream.mode.value" :scene="chatStream.inputScene.value"
                  :asset-options="chatStream.assetOptions.value" @update:user-message="chatStream.userMessage.value = $event" @update:mode="chatStream.mode.value = $event"
                  @update:scene="chatStream.inputScene.value = $event" @update:asset-options="chatStream.assetOptions.value = $event" @send-message="chatStream.sendMessage()"
                  @interrupt="chatStream.handleInterrupt" @hitl-interrupt="chatStream.handleHitlInterrupt" @upload-files="chatStream.uploadFiles" @remove-attachment="chatStream.removeAttachment"
                  @remove-script="chatStream.pendingScript.value = null" @use-generated-image="chatStream.useGeneratedImageAsReference" @set-scroll-callback="chatStream.setScrollCallback"
        />
        <SettingsView v-else-if="viewMode === 'settings'" />
        <ScriptsView v-else-if="viewMode === 'scripts'" @use-script="handleUseScript" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.new {
  font-family: Inter;
  font-size: 14px;
  font-style: normal;
  font-weight: 500;
  line-height: 20px;
  /* 142.857% */
  background: linear-gradient(101deg, #3faaf6 -10.13%, #f359dc 44.94%, #f28fb0 100%);
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.menu-item:hover .del-btn,
.menu-item.del-open .del-btn {
  display: flex;
}

.conversation-type {
  width: fit-content;
  padding: 1px 6px;
  border: 1px solid var(--colors-border-border-action);
  border-radius: 999px;
  background: var(--colors-background-bg-action);
  color: var(--colors-text-text-secondary);
  font-size: 10px;
  line-height: 14px;

  &--asset {
    border-color: color-mix(in srgb, #f359dc 30%, var(--colors-border-border-action));
    color: #d53db8;
  }
}
</style>
