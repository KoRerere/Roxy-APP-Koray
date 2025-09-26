<script setup lang="ts">
import { $t } from '/@/locales';
import { API } from '/@/api';
import { ProxyReplaceStatus, ProxyReplaceType } from '/@/enums/proxy';
import { useResponseToast } from '/@/hooks/useResponseToast'
import type { ProxyItem } from '../operation'
import type { SvgNames } from '/@/components/rx-icon';

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'replace'): void
}>()

const { data, info } = defineProps<{
  data: ProxyItem
  info: Record<string, any>
}>()

const [_, onlyErrorToast] = useResponseToast()

const helps = computed(() => [
  {
    icon: 'base/rx_ic_headphone',
    title: $t('联系我们'),
    description: $t('Roxy 技术支持将即时为您提供帮助。'),
    buttonProps: {
      label: $t('联系技术支持'),
      onClick: showLiveChat,
    },
  },
  {
    separator: true
  },
  {
    icon: 'base/rx_ic_refund',
    title: $t('申请退款 (${amount})', { amount: info.actualAmount }),
    tooltip: $t('退款金额=价格÷时长×剩余天数\n${refund} = (${amount} ÷ {days}天) × {surplus}天', {
      amount: info.proxyAmount,
      days: info.totalDays,
      surplus: info.remainingDays,
      refund: info.actualAmount
    }),
    description: $t('退款至 Roxy 钱包，预计在 {hours} 小时内处理完成。', { hours: info.refundHours }),
    class: 'help-item',
    buttonProps: {
      label: $t('退款'),
      severity: 'secondary',
      variant: 'outlined',
      onClick: () => replaceProxy(ProxyReplaceType.Refund),
    },
    visible: data.canRefund,
  },
  {
    icon: 'base/rx_ic_renew',
    title: $t('更换新代理 IP'),
    description: $t('预计在 {hours} 小时内处理完成。', { hours: info.refundHours }),
    class: 'help-item',
    buttonProps: {
      label: $t('更换'),
      severity: 'secondary',
      variant: 'outlined',
      onClick: () => replaceProxy(ProxyReplaceType.Replace),
    },
    visible: data.replaceStatus !== ProxyReplaceStatus.replaced,
  },
].filter(item => item.visible !== false))

async function replaceProxy(replaceType: ProxyReplaceType) {
  const { code, msg } = await API.proxy.userProxyRefundOrReplaceCreate({
    proxyBuyId: data.id!,
    replaceType
  })
  onlyErrorToast(code, msg)
  if (code !== 0) return
  emit('replace')
  emit('close')
}

</script>

<template>
  <div class="flex flex-col pa-6 pt-4 gap-4 rounded-lg w-120">
    <div class="h-9 flex items-center justify-between">
      <span class="header">{{ $t('帮助') }}</span>
      <SvgIcon class="cursor-pointer" color="var(--colors-icon-icon-secondary)" size="20" name="base/rx_ic_delete" @click="$emit('close')" />
    </div>
    <div class="description">
      {{ $t("我们检测到您购买的代理 IP 存在问题，以下是一些推荐的解决方案。") }}
    </div>
    <div class="flex flex-col gap-3">
      <template v-for="help in helps" :key="help.title">
        <RxDivider v-if="help.separator" />
        <div v-else class="flex items-center gap-2.5 pa-3 help" :class="help.class">
          <div class="flex-1">
            <div class="flex items-center gap-2 help-title">
              <SvgIcon :name="(help.icon as SvgNames)" color="var(--colors-icon-icon-brand)" />
              <span>{{ help.title }}</span>
              <SvgIcon v-if="help.tooltip" v-tooltip="help.tooltip" name="base/rx_ic_info" size="14" color="var(--colors-icon-icon-note)" />
            </div>
            <div class="mt-1 pl-6 help-desc">{{ help.description }}</div>
          </div>
          <RxButton v-bind="help.buttonProps" />
        </div>
      </template>
    </div>
    <div class="flex flex-col gap-1">
      <div class="subtitle">
        {{ $t('提示:') }}
      </div>
      <div class="tips">
        {{ $t('出现网络波动的代理 IP 通常会在几小时内自动恢复，若您已将其已投入长期使用计划，可以尝试耐心等待其自动恢复或联系我们取得确切答复。') }}
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.header {
  color: var(--colors-text-text-primary);
  font-size: 16px;
  font-weight: 600;
  line-height: normal;
}

.description {
  color: var(--colors-text-text-primary);
  font-size: 14px;
  line-height: 20px;
}

.subtitle {
  color: var(--colors-text-text-secondary);
  font-size: 14px;
  font-weight: 600;
  line-height: 20px;
}

.help {
  border-radius: 8px;
  border: 1px solid var(--colors-border-border-action);
  background: var(--colors-background-bg-action);

  &-item {
    border-color: transparent;
    background: var(--colors-background-bg-block);
  }

  &-title {
    color: var(--colors-text-text-primary);
    font-size: 14px;
    font-weight: 500;
    line-height: 20px;
  }

  &-desc {
    color: var(--colors-text-text-tertiary);
    font-size: 12px;
    line-height: 18px;
  }
}

.tips {
  color: var(--colors-text-text-tertiary);
  font-size: 12px;
  line-height: 18px;
}
</style>
