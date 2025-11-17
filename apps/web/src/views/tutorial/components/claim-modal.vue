<script setup lang="ts">
import TutorialVideo from '/@/views/tutorial/components/tutorial-video.vue'
import { $t } from '/@/locales';
import { copyText } from '/@/utils/basic';
import { useResponseToast } from "/@/hooks/useResponseToast";
import SpecialSupportFor from '/@/views/agent/shop/components/special-support-for.vue';

const { data } = defineProps<{
  data: Record<string, any>
}>()

defineEmits(['close', 'confirm'])

const [showToast] = useResponseToast()

function onCopy() {
  copyText(data.code)
  showToast(0, $t('复制成功'))
}

</script>

<template>
  <div class="w-140 flex flex-col pa-6 pt-4 gap-6">
    <div class="flex justify-between items-center">
      <span class="header">{{ $t('领取成功') }}</span>
      <SvgIcon class="cursor-pointer" name="base/rx_ic_delete" size="20" color="var(--colors-icon-icon-note)"
        @click="$emit('close')" />
    </div>
    <div class="h-45 flex flex-col justify-center items-center gap-3 self-stretch rounded-lg proxy">
      <SvgIcon :name="(`country-code/${data.country?.toLocaleUpperCase()}` as any)" size="64"></SvgIcon>
      <div class="proxy-text">{{ $t('{days} 天 {country} 代理 {count} 个', {
        days: data.days, country:
          data.country?.toLocaleUpperCase(), count: data.count
      }) }}</div>
      <div class="proxy-tag">{{ $t('数据中心代理') }}</div>
    </div>
    <div class="flex flex-col gap-2">
      <div class="title">{{ $t('您的兑换码') }}</div>
      <div class="flex justify-center items-center py-4 gap-2.5 rounded-lg code">
        <span>{{ data.code }}</span>
        <SvgIcon class="cursor-pointer" name="base/rx_ic_copy" size="24" color="var(--colors-icon-icon-tertiary)"
          @click="onCopy"></SvgIcon>
      </div>
    </div>
    <i18n-t tag="div" class="select-none desc"
      :keypath="$t('请根据以下指引进行代理兑换：前往费用中心，点击代理卡片旁的购买按钮，在弹出的浮层窗口中完成代理的兑换即可。{video}', { video: '{video}' })"
      scope="global">
      <template #video>
        <TutorialVideo video-url="/video/redeem_proxy.mp4">
          <template #default="{ onPlay }">
            <span class="cursor-pointer desc-link" @click="onPlay">{{ $t('[视频引导]') }}</span>
          </template>
        </TutorialVideo>
      </template>
    </i18n-t>
    <SpecialSupportFor />
    <div class="tip">{{ $t('* 您可以在费用中心兑换代码。请注意，兑换码仅对当前登录的用户有效。') }}</div>
    <RxButton size="lg" :label="$t('前往兑换')" @click="$emit('confirm')" />
  </div>
</template>

<style lang="scss" scoped>
.header {
  color: var(--colors-text-text-primary);
  font-size: 16px;
  font-weight: 600;
  line-height: normal;
}

.proxy {
  background: linear-gradient(180deg, #FFF 0%, #EFF8FF 100%);
  background-image: url('/images/claim-bg.png');
  background-size: 100% 100%;
  background-repeat: no-repeat;
  background-position: center;

  &-text {
    color: #000;
    text-align: center;
    font-family: Archivo;
    font-size: 18px;
    font-weight: 700;
    line-height: 21px;
  }

  &-tag {
    display: flex;
    padding: 4px 6px;
    justify-content: center;
    align-items: center;
    gap: 10px;
    border-radius: 2px;
    border: 1px solid #3FB6FD;
    background: #C8EBFE;
    color: #11A3FD;
    font-family: "JetBrains Mono";
    font-size: 10px;
    font-weight: 800;
    line-height: 10px;
  }
}

.title {
  color: var(--colors-text-text-primary);
  font-size: 14px;
  line-height: 21px;
}

.code {
  background: var(--colors-background-bg-block);
  color: var(--colors-text-text-primary);
  font-family: "DM Mono";
  font-size: 24px;
  font-weight: 500;
  line-height: 21px;
}

.desc {
  color: var(--colors-text-text-primary);
  font-size: 14px;
  line-height: 21px;

  &-link {
    color: var(--colors-text-text-brand);
    text-decoration-line: underline;
    text-decoration-style: solid;
    text-decoration-skip-ink: auto;
    text-decoration-thickness: auto;
    text-underline-offset: auto;
    text-underline-position: from-font;
  }
}

.tip {
  color: var(--colors-text-text-inactive);
  font-size: 12px;
  line-height: 21px;
}
</style>
