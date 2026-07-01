<script setup lang="ts">
import { getImage } from '/@/utils/basic'
import ScrollOverflowEffect from '/@/components/scroll-overflow-effect.vue'
import { useAgentApi } from './agent-api'
import type { Conversation } from './agent-api'
import { useAgentStore } from '/@/stores/agent'
import { computed, nextTick, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useThemeStore } from '/@/stores/theme'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { genDriver, isScriptRecordingEnabled, supportsApp3_8_8 } from '/@/utils'
import { useMcpDataStore } from './pinia-store/mcp-data-store'
import { useChatStreamStore } from './pinia-store/useChatStreamStore'
import type { InputScene } from './types'
import { useUserStore } from '/@/stores/user'
import { useElementSize } from '@vueuse/core'
import { API } from '/@/api'
import { MAIN_WINDOW_NAME, MAIN_WINDOW_NAVIGATION_CHANNEL_NAME } from '/@/constants/channel'
import type { UserGetPromotionInfoListData } from '@roxy/backend-api'
import { useBuyPoints } from './components/buyPointes'

const themeStore = useThemeStore()
const route = useRoute()
const router = useRouter()
const background = computed(() => themeStore.realTheme === 'dark'
  ? '/images/mcp/agent-background-dark.svg'
  : '/images/mcp/agent-background-light.svg')

const [, onlyErrorToast] = useResponseToast()
const { buyPoints } = useBuyPoints()

// API
const agentApi = useAgentApi()
const { conversationList: fetchConversationList, conversationDelete, storeInstallSkill, storeGetSkill, listSkills } = agentApi
const agentStore = useAgentStore()
const mcpDataStore = useMcpDataStore()
const userStore = useUserStore()

// 聊天相关状态
const conversationList = ref<Conversation[]>([])
const activeConversationId = ref<string>('')
const loading = ref(false)
const deletePopoverRefs = ref<Record<string, any>>({})
const openDeleteIds = ref(new Set<string>())
const promotionInfo = ref<UserGetPromotionInfoListData['data']>()

// SSE 流式逻辑提升到父级
const chatStore = useChatStreamStore()
chatStore.init(
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
  if (chatStore.isChatting || chatStore.isRecordingProcessing)
    return onlyErrorToast(-1, $t('任务进行中，不可操作'))
  chatStore.resetChat()
  activeConversationId.value = ''
  chatStore.inputScene = 'automation'
  if (route.name !== 'mcp-chat') {
    router.push('/mcp/chat')
  }
}

async function handleDeleteConversation(id: string) {
  if ((chatStore.isChatting || chatStore.isRecordingProcessing) && id === activeConversationId.value) {
    deletePopoverRefs.value[id]?.hide()
    return onlyErrorToast(-1, $t('任务进行中，不可操作'))
  }
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

function selectConversation(id: string) {
  if (chatStore.isChatting || chatStore.isRecordingProcessing)
    return onlyErrorToast(-1, $t('任务进行中，不可操作'))
  activeConversationId.value = id
  if (route.name !== 'mcp-chat') {
    router.push('/mcp/chat')
  }
}

function selectSettings() {
  if (chatStore.isChatting || chatStore.isRecordingProcessing)
    return onlyErrorToast(-1, $t('任务进行中，不可操作'))
  activeConversationId.value = ''
  router.push({ path: '/mcp/settings', query: { tab: 'mcp' } })
}

function selectSkillsStore() {
  if (chatStore.isChatting || chatStore.isRecordingProcessing)
    return onlyErrorToast(-1, $t('任务进行中，不可操作'))
  activeConversationId.value = ''
  router.push('/mcp/skills-store')
}

function selectPoints() {
  if (chatStore.isChatting || chatStore.isRecordingProcessing)
    return onlyErrorToast(-1, $t('任务进行中，不可操作'))
  activeConversationId.value = ''
  router.push('/mcp/points')
}

function selectScripts() {
  if (chatStore.isChatting || chatStore.isRecordingProcessing)
    return onlyErrorToast(-1, $t('任务进行中，不可操作'))
  activeConversationId.value = ''
  router.push('/mcp/scripts')
}

function handleGoToSkills() {
  activeConversationId.value = ''
  router.push({ path: '/mcp/settings', query: { tab: 'skills' } })
}

function handleUseScript(script: any) {
  if (chatStore.isChatting || chatStore.isRecordingProcessing)
    return onlyErrorToast(-1, $t('任务进行中，不可操作'))
  chatStore.resetChat()
  activeConversationId.value = ''
  if (route.name !== 'mcp-chat') {
    router.push('/mcp/chat')
  }
  nextTick(() => {
    chatStore.userMessage = `帮我执行 \`${script.name}\` 脚本`
    chatStore.pendingScript = script
  })
}

/**
 * 新开会话并预填技能消息（等同 skills-content 的 handleUseSkill）
 * 确保技能已下载到 Agent：未下载则调用 storeInstallSkill 等待完成。
 * @param slug - 技能的 slug（技术标识），用于下载和查询
 */
async function applySkill(slug: string) {
  try {
    // 从 agent 的商城接口查询技能信息，获取 name（展示名）
    const skillInfoRes = await storeGetSkill(slug)
    console.log('skillInfoRes', skillInfoRes)
    if (skillInfoRes.code !== 0 || !skillInfoRes.data) {
      onlyErrorToast(-1, skillInfoRes.msg || $t('未找到技能'))
      return
    }
    const skillName = skillInfoRes.data.name

    console.log('skillInfoRes.data', skillInfoRes.data)

    // 检查技能是否已下载到 Agent（查询 agent 本地已安装列表）
    const localSkillsRes = await listSkills()
    const isDownloaded = localSkillsRes.code === 0
      && localSkillsRes.data?.some((s: any) => s.slug === slug)

    if (!isDownloaded) {
      // 未下载：调用 agent 的 store install 接口下载
      const installRes = await storeInstallSkill(slug)
      if (installRes.code !== 0) {
        onlyErrorToast(-1, installRes.msg || $t('技能下载失败'))
        return
      }
      // 下载成功，同步更新缓存，让 Skills 商城列表状态立即更新
      if (mcpDataStore.userSkills && installRes.data?.userSkill) {
        mcpDataStore.userSkills.push(installRes.data.userSkill)
      }
      else {
        // userSkills 未初始化，重新拉取
        await mcpDataStore.fetchUserSkills()
      }
    }

    // 下载完成（或已下载），预填消息
    chatStore.resetChat()
    activeConversationId.value = ''
    if (route.name !== 'mcp-chat') {
      router.push('/mcp/chat')
    }
    nextTick(() => {
      chatStore.userMessage = skillInfoRes.data.usage_example || $t('使用 `{skillName}` 技能，帮我完成 ', { skillName })
      chatStore.inputScene = 'automation'
    })
  }
  catch (e: any) {
    onlyErrorToast(-1, e.message || $t('操作失败'))
  }
}

/** 切换场景（如从资源生成入口切到 asset 场景） */
function applyScene(scene: string) {
  const validScenes: InputScene[] = ['automation', 'asset']
  if (!validScenes.includes(scene as InputScene))
    return
  if (route.name !== 'mcp-chat') {
    router.push('/mcp/chat')
  }
  nextTick(() => {
    chatStore.inputScene = scene as InputScene
  })
}

// 窗口已打开时，从外部入口（如资源生成）切场景会通过主进程消息触发：
// 对话进行中则提示、不打断；否则切换场景。
const cancelUseSceneListener = globalThis.electronAPI?.on('mcp:use-scene', (scene: string) => {
  if (chatStore.isChatting || chatStore.isRecordingProcessing) {
    onlyErrorToast(-1, $t('任务进行中，不可操作'))
    return
  }
  applyScene(scene)
})

// 窗口已打开时，从 Skills 商城「去使用」会通过主进程消息触发（参数为 skill 的 slug）：
// 对话进行中则提示、不打断；否则确保下载后新开会话并预填。
const cancelUseSkillListener = globalThis.electronAPI?.on('mcp:use-skill', (slug: string) => {
  console.log('skills slug', slug)
  if (chatStore.isChatting || chatStore.isRecordingProcessing) {
    onlyErrorToast(-1, $t('任务进行中，不可操作'))
    return
  }
  applySkill(slug)
})

async function getPromotionInfo() {
  const { code, data } = await API.base.userGetPromotionInfoList()
  if (code === 0) {
    promotionInfo.value = data
  }
}

// function handleGoToInvite() {
//   const target = { name: 'referral-program' }

//   if (!globalThis.isElectron || window.name === MAIN_WINDOW_NAME) {
//     router.push(target)
//     return
//   }

//   const channel = new BroadcastChannel(MAIN_WINDOW_NAVIGATION_CHANNEL_NAME)
//   channel.postMessage(target)
//   channel.close()
// }

// 初始化
onMounted(async () => {
  const isAsset = route.query.scene === 'asset'
  if (isAsset) {
    chatStore.inputScene = 'asset'
  }
  await agentStore.initMcp()
  void mcpDataStore.prefetchAutomationModelData()
  await loadConversations(true)

  getPromotionInfo()

  // 从 Skills 商城「去使用」首次打开窗口：URL 带 skill（slug），新窗口必然不在对话中，确保下载后预填
  const skillSlug = route.query.skill as string | undefined
  if (skillSlug) {
    applySkill(skillSlug)
  }

  let _driverStatus = {}
  try {
    _driverStatus = JSON.parse(localStorage.getItem('driverStatus') || '{}')
  }
  catch (error) {

  }
  const driverObj = genDriver({
    steps: [
      {
        element: '#buyPoints',
        popover: {
          description: $t('Roxy AI Agent 现已开放积分购买。所有用户均赠送 100 起始积分'),
          side: 'top',
          align: 'center',
        },
      },
    ],
    onDestroyed: () => {
      localStorage.setItem('driverStatus', JSON.stringify({ ..._driverStatus, buyPoints: true }))
    },
  })

  if (!_driverStatus.buyPoints) {
    driverObj.drive()
  }
})

onUnmounted(() => {
  agentStore.stopHealthCheck()
  chatStore.destroy()
  cancelUseSceneListener?.()
  cancelUseSkillListener?.()
})
</script>

<template>
  <div class="relative w-full h-screen flex gap-4">
    <div class="absolute w-full h-screen z-0" :style="{ background: `url(${background}) no-repeat 50% 50% / cover` }" />

    <div class="w-full h-screen gap-4 p-4 flex relative z-1">
      <!-- 左侧边栏 -->
      <div class="w-[168px] h-full flex flex-col justify-between">
        <div class="flex-1 min-h-0 flex flex-col gap-3">
          <!-- Logo -->
          <div class="flex items-center gap-2">
            <div class="size-8 select-none">
              <img alt="" class="w-full h-full" :src="getImage('mcp/agent_avatar.png')">
            </div>
            <div class="font-['Archivo'] font-semibold text-[var(--colors-text-text-primary)] text-lg select-none">
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
              <div class="select-none font-['Inter'] font-medium text-[14px] leading-[20px] bg-[linear-gradient(101deg,#3faaf6_-10.13%,#f359dc_44.94%,#f28fb0_100%)] bg-clip-text text-transparent">
                {{ $t('新建对话') }}
              </div>
            </div>
          </div>

          <!-- Conversation List -->
          <div class="flex-1 min-h-0 flex flex-col gap-1.5 w-full">
            <div class="select-none font-['Inter'] font-600 text-[var(--colors-text-text-secondary)] text-sm">
              {{ $t('对话列表') }}
            </div>
            <ScrollOverflowEffect
              class="conversation-scroll-effect flex-1 min-h-0 !overflow-hidden"
              mode="mask"
              :light="themeStore.realTheme === 'light'"
              width="100%"
              aspect-ratio="auto"
              max-height="100%"
              :mask-size="32"
              :edge-threshold="24"
            >
              <div class="flex flex-col gap-0.5 w-full py-1">
                <div
                  v-for="item in conversationList"
                  :key="item.id"
                  class="w-full min-h-9 flex items-center justify-between px-3 rounded-lg cursor-pointer group"
                  :class="[
                    item.id === activeConversationId && route.name === 'mcp-chat' ? 'bg-[var(--pattern-sidenav-bg-hover)] font-500' : 'font-400 bg-transparent hover:bg-[var(--pattern-sidenav-bg-hover)]',
                  ]"
                  @click="selectConversation(item.id)"
                >
                  <div
                    v-tooltip.top="{ value: item.title, showDelay: 1000 }"
                    class="text-[var(--colors-text-text-primary-hover)] text-13px truncate"
                  >
                    {{ item.title }}
                  </div>

                  <!-- Delete Button -->
                  <button class="size-6 hidden items-center justify-center rounded bg-transparent outline-none border-none cursor-pointer group-hover:flex" :class="{ flex: openDeleteIds.has(item.id) }" @click.stop="openDeleteIds.add(item.id); deletePopoverRefs[item.id]?.toggle($event)">
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
                <div v-if="loading" class="text-center text-sm text-[var(--colors-text-text-primary-hover)] py-2">
                  {{ $t('加载中...') }}
                </div>
                <div v-else-if="conversationList.length === 0" class="text-center text-sm text-[var(--colors-text-text-primary-hover)] py-2">
                  {{ $t('暂无对话记录') }}
                </div>
              </div>
            </ScrollOverflowEffect>
          </div>
        </div>

        <!-- Bottom Section -->
        <div class="flex flex-col gap-1 w-full pt-1 text-13px">
          <div id="mcpAndSkills"
               class="flex items-center gap-1.5 h-9 px-3 rounded-lg cursor-pointer text-[var(--colors-text-text-primary-hover)] select-none"
               :class="route.name === 'mcp-settings' ? 'bg-[var(--pattern-sidenav-bg-hover)]' : 'hover:bg-[var(--pattern-sidenav-bg-hover)]'" @click="selectSettings"
          >
            <SvgIcon name="base/rx_ic_mcp" size="16" color="var(--colors-icon-icon-primary-hover)" />
            <div class="font-medium">
              MCP & Skills
            </div>
          </div>

          <div
            :class="route.name === 'mcp-skills-store' ? 'bg-[var(--pattern-sidenav-bg-hover)]' : 'hover:bg-[var(--pattern-sidenav-bg-hover)]'"
            class="flex items-center gap-1.5 h-9 px-3 rounded-lg cursor-pointer text-[var(--colors-text-text-primary-hover)] select-none"
            @click="selectSkillsStore"
          >
            <SvgIcon name="base/rx_ic_skills_store" size="16" color="var(--colors-icon-icon-primary-hover)" />
            <div class="font-medium">
              {{ $t('Skills 商城') }}
            </div>
            <SvgIcon name="base/fire" />
          </div>

          <ShinyButton
            v-if="supportsApp3_8_8()"
            :class="route.name === 'mcp-points' ? 'bg-[var(--pattern-sidenav-bg-hover)]' : 'hover:bg-[var(--pattern-sidenav-bg-hover)]'"
            class="w-full cursor-pointer rounded"
            @click="selectPoints"
          >
            <div
              id="buyPoints"
              class="flex items-center justify-between gap-1.5 h-9 px-3 rounded-lg cursor-pointer text-[var(--colors-text-text-primary)] select-none"
            >
              <div class="flex items-center gap-1.5">
                <SvgIcon name="roxy-agent/rx-ic-points" size="16" color="var(--colors-icon-icon-primary)" />
                <div class="font-medium">
                  {{ $t('积分：{points}', { points: userStore.userPayInfo.points }) }}
                </div>
              </div>

              <RxButton class="-mx-1.5" icon="base/rx_ic_cart" variant="outlined" severity="secondary" size="xxs" @click.stop="buyPoints" />
            </div>
          </ShinyButton>

          <div
            v-if="isScriptRecordingEnabled()"
            class="flex items-center gap-1.5 h-9 px-3 rounded-lg cursor-pointer text-[var(--colors-text-text-primary-hover)] select-none"
            :class="route.name === 'mcp-scripts' ? 'bg-[var(--pattern-sidenav-bg-hover)]' : 'hover:bg-[var(--pattern-sidenav-bg-hover)]'"
            @click="selectScripts"
          >
            <SvgIcon name="base/rx_ic_doc_code" size="16" color="var(--colors-icon-icon-primary-hover)" />
            <div class="font-medium">
              {{ $t('自动化脚本') }}
            </div>
          </div>
        </div>
      </div>

      <!-- 主内容区 -->
      <div class="relative flex-1 w-full h-full bg-[var(--colors-background-bg-page)] rounded-4 overflow-hidden">
        <router-view v-slot="{ Component }">
          <component :is="Component" @go-to-skills="handleGoToSkills" @use-script="handleUseScript" />
        </router-view>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.conversation-scroll-effect:deep(.scroll-overflow-effect) {
  min-width: 0;
  min-height: 0;
  border-radius: 12px;
  background: transparent;
  --soe-bg: transparent;
  --soe-color: var(--colors-text-text-primary);
}

.conversation-scroll-effect:deep(.scroll-overflow-effect__scroller) {
  box-shadow: none;
}
</style>
