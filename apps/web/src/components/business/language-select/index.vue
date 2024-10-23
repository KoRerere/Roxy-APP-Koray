<script lang="ts" setup>
import { ref } from 'vue'
import LiveChat from '/@/components/business/live-chat/index.vue'
import { RxSvgIcon } from '/@/components/rx-icon'
import { ISO639List } from '/@/constants/iso-639'
import { useSimpleLocale } from '/@/stores/locale'

const simpleLocale = useSimpleLocale()

const ISO639 = ref(ISO639List)

const currentLocale = ref(ISO639.value.find(item => item.locale === simpleLocale.currentLocale) || ISO639.value[0])

watch(() => currentLocale.value, (val) => {
  simpleLocale.setSimpleLocale(val.locale)
})
</script>

<template>
  <div class="card flex justify-center">
    <RxButton text class="help-btn">
      <LiveChat class="live-chat">
        <SvgIcon name="base/rx_ic_headphone_2" />
        <span class="text">
          {{ $t('Help') }}
        </span>
      </LiveChat>
    </RxButton>

    <Select v-model="currentLocale" :options="ISO639" class="w-full md:w-56">
      <template #value="slotProps">
        <div class="flex items-center">
          <RxSvgIcon :name="slotProps.value?.icon" class="mr-2" />
          <div>{{ slotProps.value.label }}</div>
        </div>
      </template>
      <template #option="slotProps">
        <div class="flex items-center">
          <RxSvgIcon :name="slotProps.option?.icon" class="mr-2" />
          <div>{{ slotProps.option.label }}</div>
        </div>
      </template>
    </Select>

    <component is="style">
      #chat-widget-container {
      left: unset!important;
      right: 30px;
      }
    </component>
  </div>
</template>

<style lang="scss" scoped>
.card {
  display: inline-flex;
  align-items: center;
  gap: 10px;

  .help-btn {
    display: flex;
    min-width: 72px;
    padding: var(--spacing-md, 6px) 10px;
    justify-content: center;
    align-items: center;
    gap: var(--spacing-md, 6px);
    color: var(--Component-Colors-Buttons-Secondary-text, #171c1f);
    text-align: center;
    font-family: Inter;
    font-size: 12px;
    font-style: normal;
    font-weight: 500;
    line-height: var(--Line-Height-text-lg, 20px); /* 166.667% */

    .live-chat {
      display: flex;
      justify-content: center;
      align-items: center;
      gap: var(--spacing-md, 6px);
    }
  }
}
</style>
