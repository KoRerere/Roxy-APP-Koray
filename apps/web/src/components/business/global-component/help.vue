<script setup lang="ts">
import QrcodeModal from '/@/components/qrcode-modal.vue'
import { $t } from '/@/locales'
import { useSimpleLocale } from '/@/stores/locale'
import { usePopupMenu } from '/@/hooks/usePopupMenu'
import { getDictMap } from '/@/utils'
import { useDialog } from '/@/hooks/useDialog'
import { API } from '/@/api'

let timer: any = null
const showTooltipDelay = 60 * 1000

const route = useRoute()
const router = useRouter()
const { currentLocale, getOfficialWebsite } = useSimpleLocale()
const { showMenu } = usePopupMenu()
const [showModal] = useDialog()

const showTooltip = ref(false)
const faqList = ref()
const qrcodeList = ref()

const items = [
  {
    label: $t('官方网站'),
    icon: 'base/rx_ic_link',
    command: () => window.open(getOfficialWebsite(), '_blank'),
  },
  {
    label: $t('用户社区'),
    icon: 'base/rx_ic_user_group',
    /**
     * command: openTelegram
     */
    command: async () => {
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
            defaultActive: qrcodeList.value.find((item: any) => item.name === (currentLocale === 'zh-CN' ? 'WeChat' : 'Telegram')),
            onClose: hideModal,
          }),
        },
      })
    },
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
]

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

onBeforeMount(() => {
  getFaqList()
})

async function getFaqList() {
  const { data } = await API.base.getFaqHelpList()
  faqList.value = data.rows
  qrcodeList.value = [
    { name: 'Telegram', value: data.tg_qrcode },
    { name: 'WeChat', value: data.wx_qrcode },
    // { name: 'QQ', value: data.qq_qrcode },
  ].filter(item => !!item.value)
}

function showHelp(event: MouseEvent) {
  showMenu(event, { model: items })
  showTooltip.value = false
}

function openTutorial() {
  router.replace({ name: 'tutorial' })
}

function openHelpDocument() {
  window.open(`https://faq.roxybrowser.com/${currentLocale!.split('-')[0]}`, '_blank')
}
</script>

<template>
  <div class="help" @click="showHelp">
    <div v-show="showTooltip" class="tooltip">
      {{ $t('有疑问吗？欢迎随时与我们联系！') }}
    </div>
    <div class="icon-box">
      <SvgIcon class="pointer-events-none mt-0.5" name="base/rx_ic_bubble" size="24" color="#FFF" />
    </div>
  </div>
  <LiveChat v-show="false" />
</template>

<style lang="scss" scoped>
.help {
  position: fixed;
  bottom: 48px;
  right: 16px;
  z-index: 100;
  filter: drop-shadow(0px 0px 5.333px rgba(0, 0, 0, 0.05));
  cursor: pointer;

  .icon-box {
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
