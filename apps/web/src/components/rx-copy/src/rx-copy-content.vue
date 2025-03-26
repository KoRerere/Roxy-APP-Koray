<script setup lang="ts">
import { useToast } from 'primevue/usetoast';
import { RxSvgIcon } from '/@/components/rx-icon';
import { $t } from '/@/locales';
import { copyText } from '/@/utils';

const props = defineProps<{
  text: string,
  mask?: boolean,
  maskText?: string,
}>()

const emit = defineEmits(['onMaskTextClick'])

const toast = useToast()

async function onCopy() {
  copyText(props.text)
  toast.add({ severity: 'success', summary: $t('操作成功'), detail: $t('复制成功'), life: 2500 })
}
</script>

<template>
  <div class="rx-copy-content">
    <div v-if="mask" class="mask">
      <slot name="maskText">
        <div v-if="maskText" class="mask-text" @click.stop="emit('onMaskTextClick')">
          {{ maskText }}
        </div>
      </slot>
    </div>
    <div class="text-value">
      {{ text }}
      <template v-if="mask && !text">
        https://roxybrowser.com/invite?code=13122341233
      </template>
    </div>
    <RxButton v-if="!mask" class="flex-shrink-0 copy-btn" text size="xxs" icon="base/rx_ic_copy" :label="$t('复制')"
      @click.stop="onCopy" />
  </div>
</template>

<style scoped>
:where(.rx-copy-content) {

  position: relative;
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-xl, 12px);
  gap: var(--spacing-xl, 12px);
  border-radius: var(--radius-md, 6px);
  border: 1px solid var(--Color-neutrals-900, #171C1F);
  background: var(--Color-neutrals-800, #252A2E);
  min-height: 30px;
  overflow: hidden;

  .text-value {
    height: 100%;
    overflow-y: auto;
    color: #fff;
    font-family: 'JetBrains Mono';
    font-size: 14px;
    font-weight: 500;
    word-break: break-word;
  }

  &:hover {
    .copy-btn {
      display: flex;
    }
  }

  .copy-btn {
    display: none;
    position: absolute !important;
    right: 6px;
    top: 6px;
    background: #575D61;
    border-color: transparent;
    color: white;
  }

  .mask {
    position: absolute;
    inset: 0;
    color: #FFF;
    font-size: 14px;
    font-style: normal;
    font-weight: 500;
    line-height: 18px;
    backdrop-filter: blur(5px);
    z-index: 10;
    display: flex;
    justify-content: center;
    align-items: center;

    .mask-text {
      display: flex;
      min-width: 56px;
      padding: var(--spacing-sm, 4px) var(--spacing-md, 6px);
      justify-content: center;
      align-items: center;
      gap: var(--spacing-sm, 4px);
      border-radius: var(--radius-sm, 4px);
      background: var(--Colors-Alpha-alpha-white-30, rgba(255, 255, 255, 0.30));
      box-shadow: 0px 4px 4px -1px rgba(0, 0, 0, 0.02), 0px 1px 1px 0px rgba(0, 0, 0, 0.06);
      cursor: pointer;
    }
  }
}
</style>
