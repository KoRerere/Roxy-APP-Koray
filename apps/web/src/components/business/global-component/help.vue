<script setup lang="tsx">
import { h } from 'vue'
import Score from '/@/views/tutorial/components/score'
import QrcodeModal from '/@/components/qrcode-modal.vue'
import { RxSvgIcon } from '/@/components/rx-icon'
// import { useUserStore } from '/@/stores/user'
// import { useWorkspaceStore } from '/@/stores/workspace'
import { useSimpleLocale } from '/@/stores/locale'
// import { useRoleStore } from '/@/stores/role'
import { usePermission } from '/@/hooks/usePermission'
import { usePopupMenu } from '/@/hooks/usePopupMenu'
import { getDictMap } from '/@/utils'
import { useDialog } from '/@/hooks/useDialog'
import { API } from '/@/api'
// import { useOnboardingTaskStatus } from '/@/views/tutorial/hooks.ts'
import AgentLabel from './agent-label.vue'
import { useOpenRoxyAIAgent } from '/@/hooks/useOpenRoxyAIAgent'
import type { ViewportPoint } from '/@/hooks/useViewportDraggableFloating'
import { clampPointToViewport, useViewportDraggableFloatingGroup } from '/@/hooks/useViewportDraggableFloating'

let timer: any = null
const showTooltipDelay = 60 * 1000

// 用于强制重新创建 AgentLabel 组件的 key
const agentLabelKey = ref(0)
// 每 30 分钟刷新一次组件
const AGENT_LABEL_REFRESH_INTERVAL = 1 * 60 * 1000

const route = useRoute()
const router = useRouter()
const { check } = usePermission()
const { currentLocale, getOfficialWebsite } = useSimpleLocale()
// const { currentWorkspace } = storeToRefs(useWorkspaceStore())
// const { isOwner, isManager } = storeToRefs(useRoleStore())
// const { token } = storeToRefs(useUserStore())
// const { onboardingTaskStatus } = useOnboardingTaskStatus()
const { showMenu } = usePopupMenu()
const [showModal] = useDialog()
const { openRoxyAIAgent } = useOpenRoxyAIAgent()

/** 帮助区悬浮组（Agent + 气泡）整体位置持久化 */
const HELP_FLOAT_STORAGE_KEY = 'roxy-browser.helpFloatPositions.v2'
const HELP_FLOAT_STORAGE_KEY_V1 = 'roxy-browser.helpFloatPositions.v1'
const HELP_FLOAT_RIGHT_GAP = 16

const helpDockRef = useTemplateRef('helpDock')

function migrateHelpFloatStorageFromV1() {
  try {
    if (localStorage.getItem(HELP_FLOAT_STORAGE_KEY))
      return
    const raw = localStorage.getItem(HELP_FLOAT_STORAGE_KEY_V1)
    if (!raw)
      return
    const parsed = JSON.parse(raw) as { bubble?: ViewportPoint }
    if (parsed?.bubble && Number.isFinite(parsed.bubble.top))
      localStorage.setItem(HELP_FLOAT_STORAGE_KEY, JSON.stringify({ dock: parsed.bubble }))
  }
  catch {
    // ignore
  }
}

function defaultHelpDockPos(): ViewportPoint {
  const gapBottom = 72
  const w = helpDockRef.value?.offsetWidth ?? 40
  const h = helpDockRef.value?.offsetHeight ?? 40
  return clampPointToViewport(
    window.innerWidth - HELP_FLOAT_RIGHT_GAP - w,
    window.innerHeight - gapBottom - h,
    w,
    h,
  )
}

const {
  layers: helpFloatLayers,
  layoutReady: helpFloatLayoutReady,
  bootstrapLayout: bootstrapHelpFloatLayout,
} = useViewportDraggableFloatingGroup<'dock'>({
  storageKey: HELP_FLOAT_STORAGE_KEY,
  hideUntilHydrated: true,
  dragConstraint: { mode: 'right-edge-vertical', rightGap: HELP_FLOAT_RIGHT_GAP },
  layers: [
    {
      key: 'dock',
      elRef: helpDockRef,
      getDefaultPosition: () => defaultHelpDockPos(),
    },
  ],
})

const helpDockFloat = helpFloatLayers.dock

const helpDockCss = computed(() => {
  const { left, top } = helpDockFloat.position.value
  return { left: `${left}px`, top: `${top}px` }
})

function onBubbleTriggeredClick(ev: MouseEvent) {
  if (helpDockFloat.swallowFollowingClick(ev))
    return
  showHelp(ev)
}

function onAgentTriggeredClick(ev: MouseEvent) {
  if (helpDockFloat.swallowFollowingClick(ev))
    return
  openRoxyAIAgent()
}

const showTooltip = ref(false)
const qrcodeMap = ref<Record<string, any>>({})
const qrcodeList = ref<any[]>([])

const supportCss = useCssModule('support')

const items = computed(() => {
  return [
    {
      label: $t('购买代理 IP'),
      command: showLiveChat,
      render: () => (
        <div class={`relative h-8 w-full flex items-center py-2 pl-2.5 pr-1.5 gap-1.5 rounded-0.5 overflow-hidden ${supportCss.item}`}>
          <RxSvgIcon name="base/rx_ic_headphone_2"></RxSvgIcon>
          <span>{$t('联系在线技术支持')}</span>
          <svg class="absolute top-0 right-1.5" xmlns="http://www.w3.org/2000/svg" width="36" height="26" viewBox="0 0 36 26" fill="none">
            <g clip-path="url(#clip0_29550_21212)">
              <path fill-rule="evenodd" clip-rule="evenodd" d="M25.765 -8.10673C22.2857 -9.78463 18.3566 -10.2908 14.5656 -9.54937C10.7746 -8.80799 7.32565 -6.85895 4.73475 -3.99392C2.14386 -1.12889 0.550374 2.49809 0.192732 6.34429C-0.164911 10.1905 0.732524 14.0491 2.75075 17.3427L0.197318 24.1441C0.117494 24.3567 0.0953769 24.5866 0.133217 24.8104C0.171057 25.0343 0.267504 25.2442 0.412751 25.4187C0.557998 25.5932 0.746866 25.7261 0.96015 25.8039C1.17343 25.8818 1.40353 25.9018 1.62703 25.8618L10.5396 24.2496C14.8303 26.2686 19.7473 26.5004 24.209 24.8941C26.4182 24.0987 28.4491 22.876 30.1857 21.2958C31.9224 19.7155 33.3307 17.8087 34.3305 15.6841C35.3302 13.5596 35.9016 11.2589 36.0122 8.91354C36.1228 6.56814 35.7704 4.22393 34.975 2.01474C34.1796 -0.194443 32.9569 -2.22533 31.3767 -3.96198C29.7964 -5.69862 27.8896 -7.10701 25.765 -8.10673Z" fill="white" fill-opacity="0.2" />
              <path fill-rule="evenodd" clip-rule="evenodd" d="M18.4989 1.28465C18.1277 1.21045 17.7446 1.21957 17.3773 1.31133C17.01 1.4031 16.6676 1.57522 16.3749 1.8153C16.0822 2.05538 15.8464 2.35743 15.6845 2.69966C15.5227 3.04189 15.4388 3.41578 15.4389 3.79436C15.4389 4.2206 15.2696 4.62938 14.9682 4.93078C14.6668 5.23218 14.258 5.4015 13.8318 5.4015C13.4055 5.4015 12.9967 5.23218 12.6953 4.93078C12.3939 4.62938 12.2246 4.2206 12.2246 3.79436C12.225 2.72194 12.524 1.67083 13.0883 0.758861C13.6526 -0.153107 14.4597 -0.889872 15.4192 -1.36883C16.3787 -1.84779 17.4527 -2.05 18.5207 -1.9528C19.5887 -1.8556 20.6085 -1.46282 21.4658 -0.818513C22.3231 -0.174204 22.984 0.696169 23.3743 1.69502C23.7647 2.69387 23.8691 3.78171 23.6758 4.83657C23.4826 5.89143 22.9993 6.87161 22.2802 7.66721C21.5611 8.46281 20.6346 9.04237 19.6046 9.34093V10.7398C19.6046 11.166 19.4353 11.5748 19.1339 11.8762C18.8325 12.1776 18.4237 12.3469 17.9975 12.3469C17.5712 12.3469 17.1624 12.1776 16.861 11.8762C16.5596 11.5748 16.3903 11.166 16.3903 10.7398V7.96265C16.3903 7.07293 17.1103 6.3555 18 6.3555C18.6378 6.35914 19.2538 6.1245 19.7276 5.69755C20.2013 5.2706 20.4985 4.68213 20.5609 4.04747C20.6234 3.41281 20.4465 2.7777 20.0651 2.26663C19.6836 1.75555 19.1251 1.40535 18.4989 1.28465ZM18 19.2898C17.3897 19.2891 16.8046 19.046 16.3734 18.6139C15.9423 18.1818 15.7005 17.5962 15.7012 16.9858C15.7019 16.3754 15.945 15.7903 16.3771 15.3592C16.8092 14.9281 17.3948 14.6863 18.0052 14.6869H18.0103C18.6207 14.6876 19.2058 14.9307 19.6369 15.3628C20.068 15.7949 20.3099 16.3806 20.3092 16.9909C20.3085 17.6013 20.0654 18.1864 19.6333 18.6175C19.2012 19.0487 18.6156 19.2905 18.0052 19.2898H18Z" fill="#0086D9" fill-opacity="0.4" />
            </g>
            <defs>
              <clipPath id="clip0_29550_21212">
                <rect width="36" height="36" fill="white" transform="translate(0 -10)" />
              </clipPath>
            </defs>
          </svg>
        </div>
      ),
    },
    {
      separator: true,
    },
    {
      label: $t('微信客服与群组🎁'),
      icon: 'base/rx_ic_wechat',
      visible: !!qrcodeMap.value.WeChat && currentLocale === 'zh-CN',
      command: () => openCommunity('WeChat'),
    },
    {
      visible: !!qrcodeMap.value.WeChat && currentLocale === 'zh-CN',
      separator: true,
    },
    {
      label: $t('Telegram 群组'),
      icon: 'base/rx_ic_telegram_2',
      visible: !!qrcodeMap.value.Telegram,
      command: async () => openCommunity('Telegram'),
    },
    {
      separator: true,
    },
    {
      label: $t('意见反馈'),
      icon: 'base/rx_ic_survy',
      command: async () => {
        const $dict_map = await getDictMap()
        const tgLink = $dict_map.feedback!.find((item: any) => item.label === currentLocale) || $dict_map.tgLink![0]
        window.open(tgLink!.value, '_blank')
      },
    },
    {
      label: $t('官方网站'),
      icon: 'base/rx_ic_link',
      command: () => window.open(getOfficialWebsite(), '_blank'),
    },
    {
      label: $t('帮助文档'),
      icon: 'base/rx_ic_doc_article',
      command: openHelpDocument,
    },
    {
      label: $t('新手教程'),
      icon: 'base/rx_ic_books',
      command: openTutorial,
    },
    {
      separator: true,
    },
    {
      label: $t('评价我们🎁'),
      icon: 'base/rx_ic_star',
      /**
       * visible: onboardingTaskStatus.value?.ratingStatus === false,
       */
      command: () => openScore(),
    },
  ].filter(item => item.visible !== false)
})

watch(() => route.path, () => {
  clearTimeout(timer)
  if (route.name === 'subscribe-plan') {
    // 付费计划页面停留 60 秒后显示提示
    timer = setTimeout(() => {
      showTooltip.value = true
    }, showTooltipDelay)
  }
  else {
    showTooltip.value = false
  }
}, { immediate: true })

let agentLabelTimer: any = null

onBeforeMount(() => {
  migrateHelpFloatStorageFromV1()
  getFaqList()
})

onMounted(() => {
  bootstrapHelpFloatLayout()
  // 每 30 分钟更新一次 key，强制重新创建 AgentLabel
  agentLabelTimer = setInterval(() => {
    agentLabelKey.value++
  }, AGENT_LABEL_REFRESH_INTERVAL)
})

onBeforeUnmount(() => {
  if (agentLabelTimer)
    clearInterval(agentLabelTimer)
})

async function getFaqList() {
  const { code, data } = await API.base.getFaqHelpList()
  if (code !== 0)
    return

  qrcodeMap.value = {
    Telegram: data.tg_qrcode,
    WeChat: data.wx_qrcode,
  }

  qrcodeList.value = Object.entries(qrcodeMap.value)
    .map(([key, value]) => ({ name: key, value }))
    .filter(item => !!item.value)
}

function showHelp(event: MouseEvent) {
  showMenu(event, { model: items.value })
  showTooltip.value = false
}

async function openCommunity(name: string) {
  const $dict_map = await getDictMap()
  const tgLink = $dict_map.tgLink!.find((item: any) => item.label === currentLocale) || $dict_map.tgLink![0]

  const tg = qrcodeList.value.find((item: any) => item.name === 'Telegram')
  if (tg) {
    Reflect.set(tg, 'link', tgLink!.value)
  }
  showModal({
    showHeader: false,
    modal: true,
    blockScroll: true,
    slots: {
      container: ({ hideModal }) => h(QrcodeModal, {
        list: qrcodeList.value,
        defaultActive: qrcodeList.value.find((item: any) => item.name === name),
        onClose: hideModal,
      }),
    },
  })
}

function openTutorial() {
  router.replace({ name: 'tutorial' })
}

function openHelpDocument() {
  window.open(`https://faq.roxybrowser.com/${currentLocale!.split('-')[0]}`, '_blank')
}

function openScore() {
  showModal({
    showHeader: false,
    modal: true,
    blockScroll: true,
    slots: {
      container: ({ hideModal }) => <Score openType="user_click" onClose={hideModal}></Score>,
    },
  })
}
</script>

<template>
  <!-- Agent + 帮助气泡并排，整体拖拽 -->
  <div ref="helpDock" class="help-float-dock touch-none select-none" :class="[
    { 'help-float-dock-dragging': helpDockFloat.dragging },
    helpFloatLayoutReady ? 'opacity-100' : 'opacity-0 pointer-events-none',
  ]" :style="helpDockCss" @pointerdown="helpDockFloat.onPointerDown"
  >
    <div v-if="check('Roxy_AI_Agent_All')" id="mcp" class="help-float-item help-float-item-agent flex shrink-0" @click="onAgentTriggeredClick">
      <AgentLabel :key="agentLabelKey" />
    </div>
    <div class="help-float-item help-float-item-bubble relative shrink-0" @click="onBubbleTriggeredClick">
      <div v-show="showTooltip" class="absolute right-0 -top-7.5 inline-flex px-2 py-1 rounded-1 whitespace-nowrap tooltip pointer-events-none">
        {{ $t('有疑问吗？欢迎随时与我们联系！') }}
      </div>
      <div class="w-10 h-10 flex items-center justify-center rounded-full icon">
        <SvgIcon class="pointer-events-none" name="base/rx_ic_customer_support" size="22" color="#FFFFFF" />
      </div>
    </div>
  </div>
  <LiveChat v-show="false" />
</template>

<style lang="scss" module="support">
.item {
  color: var(--component-dropdown-text-active);
  font-size: 13px;
  font-weight: 700;
  background: var(--colors-background-bg-brand);
}
</style>

<style lang="scss" scoped>
.help-float-dock {
  position: fixed;
  z-index: 100;
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 10px;
  touch-action: none;
  user-select: none;
  filter: drop-shadow(0px 0px 5.333px rgba(0, 0, 0, 0.05));
  cursor: grab;
}

.help-float-item {
  cursor: pointer;
}

.icon {
  background-color: #12a3fc;
}

.tooltip {
  background: var(--primitives-neutrals-900, #171c1f);
  box-shadow:
    0px 3px 8px 0px rgba(0, 0, 0, 0.07),
    0px 2px 5px 0px rgba(0, 0, 0, 0.07),
    0px 1px 1px 0px rgba(0, 0, 0, 0.07);
  color: var(--primitives-neutrals-0, #fff);
  font-size: 12px;
  font-weight: 600;
  line-height: 16px;
  pointer-events: none;
}
</style>
