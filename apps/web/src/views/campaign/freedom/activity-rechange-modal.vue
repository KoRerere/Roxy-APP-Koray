<script setup lang="ts">
// import { useDialog } from '/@/hooks/useDialog'
import { getImage } from '/@/utils/basic'
import { emitter } from '/@/utils/eventBus'
import { useCampaignStore } from '/@/stores/campaign'

defineProps<{
  isNext?: boolean
}>()

const emit = defineEmits(['close'])

const { currentActivity } = storeToRefs(useCampaignStore())
// const [showModal] = useDialog()

function onExpand() {
  emit('close')
  emitter.emit('showExpandDialog', {
    defaultType: 'staff',
    paySuccess: () => {
      emitter.emit('updateBillList')
    },
  })
}

function onConfirm() {
  emit('close')
}
</script>

<template>
  <div class="w-120 flex flex-col gap-4 pa-6 pt-4 rounded-2">
    <div class="h-9 flex items-center justify-between">
      <div class="tt-primary text-4 font-600 leading-normal">
        {{ $t('欢迎加入五月自由季') }}
      </div>
      <SvgIcon class="cursor-pointer" name="base/rx_ic_delete" size="20" color="var(--colors-icon-icon-secondary)" @click="$emit('close')" />
    </div>

    <div class="flex flex-col items-center gap-3 py-3">
      <img class="w-15 h-15 rounded-3" :src="getImage('campaing/freedom/palm_tree_icon.svg')">
      <div class="freedom">
        {{ $t('五月自由季') }}
      </div>
    </div>

    <div class="flex flex-col gap-3">
      <div class="tt-primary text-4 font-700 leading-6">
        {{ $t('恭喜！您已正式成为 May Freedom 成员') }}
      </div>
      <div>
        <div class="desc">
          {{ $t('您可以享受以下权益：') }}
        </div>
      </div>
      <div class="flex flex-col gap-2">
        <div class="flex items-center gap-1.5">
          <SvgIcon name="base/rx_ic_check_line" size="18" color="var(--colors-icon-icon-success)" />
          <span class="desc">{{ $t('订阅 / 续费终身享受 {value}% 折扣', { value: currentActivity.discount }) }}</span>
        </div>
        <div class="flex items-center gap-1.5">
          <SvgIcon name="base/rx_ic_check_line" size="18" color="var(--colors-icon-icon-success)" />
          <span class="desc">{{ $t('Beta 版优先体验') }}</span>
        </div>
        <div class="flex items-center gap-1.5">
          <SvgIcon name="base/rx_ic_check_line" size="18" color="var(--colors-icon-icon-success)" />
          <i18n-t tag="span" class="desc" :keypath="$t('购买任意数量 {link} 席位，加送 {count} 个席位。', { link: '{link}', count: currentActivity.gift_members })">
            <template #link>
              <span class="link cursor-pointer" @click="onExpand">{{ $t('团队成员') }}</span>
            </template>
          </i18n-t>
        </div>
      </div>
    </div>

    <RxButton class="mt-1" :label="isNext ? $t('开始抽奖') : $t('确认')" size="lg" @click="onConfirm" />
  </div>
</template>

<style lang="scss" module></style>

<style lang="scss" scoped>
.freedom {
  font-family: 'DingTalk JinBuTi';
  font-size: 20px;
  line-height: normal;
  background: linear-gradient(91deg, #4096ff 0%, #01cab3 100%);
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.desc {
  color: var(--colors-text-text-primary);
  font-size: 14px;
  line-height: normal;
}

.link {
  color: var(--colors-text-text-link);
  text-decoration-line: underline;
  text-decoration-style: solid;
  text-decoration-skip-ink: auto;
  text-decoration-thickness: auto;
  text-underline-offset: auto;
  text-underline-position: from-font;
}
</style>
