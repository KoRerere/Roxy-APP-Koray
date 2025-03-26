<template>
  <div class="help" @click="toggle">
    <div v-show="showTooltip" class="tooltip">{{ $t('有疑问吗？欢迎随时与我们联系！') }}</div>
    <div class="icon-box">
      <RxSvgIcon name="base/rx_ic_bubble" size="24" color="#FFF" class="mt-[2px]" />
    </div>
    <Menu ref="menu" :model="items" :popup="true">
      <template #item="{ item, props }">
        <a v-ripple class="flex items-center" v-bind="props.action">
          <RxSvgIcon :name="(item.icon as SvgNames)" />
          <span>{{ item.label }}</span>
        </a>
      </template>
    </Menu>
  </div>
  <LiveChat v-show="false"></LiveChat>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { RxSvgIcon, type SvgNames } from "/@/components/rx-icon";
import { $t } from "/@/locales";
import { useSimpleLocale } from "/@/stores/locale";
import { getDictMap } from "/@/utils";


let timer: any = null
const showTooltipDelay = 60 * 1000
const route = useRoute()
const { currentLocale, getOfficialWebsite } = useSimpleLocale()
const showTooltip = ref(false)


const menu = ref();
const items = ref([
  {
    label: $t('官方网站'),
    icon: 'base/rx_ic_link',
    command: () => window.open(getOfficialWebsite(), '_blank')
  },
  {
    label: $t('用户社区'),
    icon: 'base/rx_ic_telegram_2',
    command: async () => {
      const $dict_map = await getDictMap()
      const tgLink = $dict_map.tgLink.find((item: any) => item.label === currentLocale) || $dict_map.tgLink[0]
      window.open(tgLink.value, '_blank')
    }
  },
  {
    separator: true
  },
  {
    label: $t('支持文档'),
    icon: 'base/rx_ic_books',
    command: () => window.open(`https://faq.roxybrowser.org/${currentLocale.split('-')[0]}`, '_blank')
  },
  {
    label: $t('意见反馈'),
    icon: 'base/rx_ic_survy',
    command: async () => {
      const $dict_map = await getDictMap()
      const tgLink = $dict_map.feedback.find((item: any) => item.label === currentLocale) || $dict_map.tgLink[0]
      window.open(tgLink.value, '_blank')
    }
  },
  {
    label: $t('联系支持'),
    icon: 'base/rx_ic_headphone_2',
    command: () => LiveChatWidget.call('maximize')
  }
]);

watch(() => route.path, () => {
  clearTimeout(timer)
  if (route.name === 'subscribe-plan') {
    // 付费计划页面停留 60 秒后显示提示
    timer = setTimeout(() => {
      showTooltip.value = true
    }, showTooltipDelay)
  } else {
    showTooltip.value = false
  }
}, { immediate: true })

const toggle = (event: Event) => {
  showTooltip.value = false
  menu.value.toggle(event);
};
</script>

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
    background-color: #12A3FC;
    border-radius: 50%;
    border: 1px solid #FFF;
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
    background: var(--Color-neutrals-900, #171C1F);

    /* shadow-md */
    box-shadow: 0px 3px 8px 0px rgba(0, 0, 0, 0.07), 0px 2px 5px 0px rgba(0, 0, 0, 0.07), 0px 1px 1px 0px rgba(0, 0, 0, 0.07);
    white-space: nowrap;
    color: var(--Color-neutrals-0, #FFF);
    text-align: center;
    font-family: Inter;
    font-size: 12px;
    font-style: normal;
    font-weight: 600;
    line-height: var(--Line-Height-text-xs, 16px);
    pointer-events: none;
  }
}
</style>
