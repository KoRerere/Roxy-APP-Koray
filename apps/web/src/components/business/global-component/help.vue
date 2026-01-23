<script setup lang="ts">
import QrcodeModal from '/@/components/qrcode-modal.vue'
import { driver } from 'driver.js'
import 'driver.js/dist/driver.css'
import { useUserStore } from '/@/stores/user'
import { useWorkspaceStore } from '/@/stores/workspace'
import { useSimpleLocale } from '/@/stores/locale'
import { usePopupMenu } from '/@/hooks/usePopupMenu'
import { getDictMap, safeParseJSON, sleep } from '/@/utils'
import { useDialog } from '/@/hooks/useDialog'
import { API } from '/@/api'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { emitter } from '/@/utils/eventBus'
import { Role } from '/@/enums/role'

let timer: any = null
const showTooltipDelay = 60 * 1000

const route = useRoute()
const router = useRouter()
const { currentLocale, getOfficialWebsite } = useSimpleLocale()
const { showMenu } = usePopupMenu()
const [showModal] = useDialog()
const [, onlyErrorToast] = useResponseToast()
const { token } = storeToRefs(useUserStore())
const { currentWorkspace } = storeToRefs(useWorkspaceStore())

const showTooltip = ref(false)
const faqList = ref()
const qrcodeMap = ref<Record<string, any>>({})
const qrcodeList = ref<any[]>([])

const showMcp = ref(false)
const driverStatus = safeParseJSON(localStorage.getItem('driverStatus')) ?? {}

const items = computed(() => {
  return [
    {
      label: $t('官方网站'),
      icon: 'base/rx_ic_link',
      command: () => window.open(getOfficialWebsite(), '_blank'),
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
      label: $t('新手教程'),
      icon: 'base/rx_ic_books',
      command: openTutorial,
    },
    {
      label: $t('帮助文档'),
      icon: 'base/rx_ic_doc_article',
      command: openHelpDocument,
    },
    {
      label: $t('联系技术支持'),
      icon: 'base/rx_ic_headphone_2',
      command: showLiveChat,
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

watch([token, () => currentWorkspace.value?.id], ([token, currentWorkspaceId]) => {
  if (token && currentWorkspaceId) {
    getMcpInfo()
  }
}, { immediate: true })

onBeforeMount(() => {
  getFaqList()
})

const guideCss = useCssModule('guide')

emitter.on('focusMcp', () => {
  driverHighlight()
})

async function getMcpInfo() {
  if (!currentWorkspace.value || ![Role.OWNER, Role.MANAGER].includes(currentWorkspace.value.role!)) {
    showMcp.value = false
    return
  }

  const { code, data } = await API.base.userGetLlmInfoList()
  const apiResult = await API.base.userGetUserApiList()
  if (code === 0 && !!data?.apikey && apiResult.code === 0) {
    showMcp.value = true
  }
  else {
    showMcp.value = false
    updateDriverStatus()
  }
}

async function driverHighlight() {
  if (driverStatus?.mcpGuide)
    return

  await Promise.all([
    sleep(50), // 延迟 50ms 让外部元素加载完成
    nextTick(),
  ])

  const driverObj = driver({
    nextBtnText: $t('下一步'),
    doneBtnText: $t('完成'),
    showButtons: ['next'],
    overlayColor: 'var(--pattern-tour-mask-bg)',
    overlayOpacity: 1,
    allowClose: false,
    disableActiveInteraction: true,
    popoverClass: guideCss.popover,
    steps: [
      {
        element: '#mcp',
        popover: {
          description: $t('Roxy AI Agent 可以帮你管理浏览器窗口、平台账号还有代理，并帮助您实现浏览器的自动化操作'),
          side: 'left',
          align: 'center',
        },
      },

    ],
    onDestroyed: () => {
      updateDriverStatus()
    },
  })

  driverObj.drive()
}

function updateDriverStatus() {
  driverStatus.mcpGuide = true
  localStorage.setItem('driverStatus', JSON.stringify({ ...driverStatus, mcpGuide: true }))
}

async function getFaqList() {
  const { code, data } = await API.base.getFaqHelpList()
  if (code !== 0)
    return
  faqList.value = data.rows

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

async function openMCP() {
  const { code, data, msg } = await API.base.userGetUserApiList()
  onlyErrorToast(code, msg)
  if (code === 0) {
    if (!data.open) {
      const { code, msg } = await API.base.userSetUserApiCreate({
        ...data,
        open: true,
      })
      onlyErrorToast(code, msg)
      if (code === 0) {
        await electronAPI.send('app:restartAPIServer')
      }
    }
    await electronAPI.send('mcp:open')
  }
}
</script>

<template>
  <div class="help">
    <div v-show="showTooltip" class="tooltip">
      {{ $t('有疑问吗？欢迎随时与我们联系！') }}
    </div>
    <div v-if="showMcp" id="mcp" class="flex cursor-pointer" @click="openMCP">
      <img draggable="false" src="/images/mcp/roxy_ai_agent.svg">
    </div>
    <div class="icon-box" @click="showHelp">
      <SvgIcon class="pointer-events-none mt-0.5" name="base/rx_ic_bubble" size="24" color="#FFF" />
    </div>
  </div>
  <LiveChat v-show="false" />
</template>

<style lang="scss" scoped>
.help {
  position: fixed;
  bottom: 72px;
  right: 16px;
  z-index: 100;
  filter: drop-shadow(0px 0px 5.333px rgba(0, 0, 0, 0.05));
  display: flex;
  align-items: center;
  // justify-content: center;
  gap: 10px;

  .icon-box {
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    background-color: #12a3fc;
    border-radius: 50%;
  }

  .tooltip {
    position: absolute;
    top: -30px;
    right: 0;
    display: inline-flex;
    padding: var(--spacing-sm, 4px) var(--spacing-lg, 8px);
    justify-content: center;
    align-items: center;
    gap: 10px;
    border-radius: var(--radius-sm, 4px);
    background: var(--primitives-neutrals-900, #171c1f);

    /* shadow-md */
    box-shadow:
      0px 3px 8px 0px rgba(0, 0, 0, 0.07),
      0px 2px 5px 0px rgba(0, 0, 0, 0.07),
      0px 1px 1px 0px rgba(0, 0, 0, 0.07);
    white-space: nowrap;
    color: var(--primitives-neutrals-0, #fff);
    text-align: center;
    font-family: Inter;
    font-size: 12px;
    font-style: normal;
    font-weight: 600;
    line-height: var(--Line-Height-text-xs, 16px);
    pointer-events: none;
  }
}

.faq {
  &-header {
    color: var(--colors-text-text-primary);
    font-size: 12px;
    font-weight: 700;
    line-height: 16px;
  }

  &-title {
    color: var(--colors-text-text-primary);
    font-size: 13px;
    line-height: 16px;
  }

  &-content {
    &::-webkit-scrollbar {
      display: none;
    }
  }

  &-desc {
    color: var(--colors-text-text-secondary);
    font-size: 13px;
    line-height: 1.5;
  }

  &-btn {
    background: var(--campaign-netflix-bg-faq-btn);
    color: var(--colors-text-text-primary);
    font-size: 12px;
    line-height: 16px;

    &:hover {
      opacity: 0.8;
    }
  }
}

.slide-left-enter-active,
.slide-left-leave-active,
.slide-right-enter-active,
.slide-right-leave-active {
  transition:
    transform 0.3s ease,
    opacity 0.3s ease;
  position: absolute;
  width: 100%;
  height: 100%;
}

.slide-left-enter-from {
  transform: translateX(100%);
  opacity: 0;
}

.slide-left-leave-to {
  transform: translateX(-100%);
  opacity: 0;
}

.slide-right-enter-from {
  transform: translateX(-100%);
  opacity: 0;
}

.slide-right-leave-to {
  transform: translateX(100%);
  opacity: 0;
}
</style>

<style module="guide">
.popover {
  min-width: 220px;
  max-width: 220px;
  padding: 12px;
  border-radius: 6px;
  background: var(--pattern-tour-tips-bg);
  box-shadow:
    0 3px 8px 0 rgba(0, 0, 0, 0.07),
    0 2px 5px 0 rgba(0, 0, 0, 0.07),
    0 1px 1px 0 rgba(0, 0, 0, 0.07);

  :global(.driver-popover-description),
  :global(.driver-popover-progress-text) {
    color: var(--component-tooltip-text-primary);
    font-family: Inter;
    font-size: 12px;
    font-weight: 400;
    line-height: 16px;
  }

  :global(.driver-popover-footer) {
    margin-top: 6px;
  }

  :global(.driver-popover-arrow-side-left.driver-popover-arrow) {
    border-left-color: var(--pattern-tour-tips-bg);
  }

  :global(.driver-popover-arrow-side-right.driver-popover-arrow) {
    border-right-color: var(--pattern-tour-tips-bg);
  }

  :global(.driver-popover-arrow-side-top.driver-popover-arrow) {
    border-top-color: var(--pattern-tour-tips-bg);
  }

  :global(.driver-popover-arrow-side-bottom.driver-popover-arrow) {
    border-bottom-color: var(--pattern-tour-tips-bg);
  }

  button {
    min-width: 60px;
    padding: 4px 8px;
    text-align: center;
    border-radius: 4px;
    background: var(--colors-alpha-alpha-white-20);
    color: var(--component-tooltip-text-primary);
    font-family: Inter;
    font-size: 12px;
    font-weight: 400;
    line-height: 16px;
    border: none;
    text-shadow: none;

    &:focus,
    &:hover {
      background: var(--colors-alpha-alpha-white-20);
    }
  }
}
</style>
