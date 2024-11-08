<script lang="ts" setup>
import { ref } from 'vue'
import LiveChat from '/@/components/business/live-chat/index.vue'
import RxInputSelect from '/@/components/ry-form/rx-input-select.vue'
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
    <RxButton text severity="secondary" class="help-btn">
      <LiveChat class="live-chat">
        <SvgIcon name="base/rx_ic_headphone_2" />
        <span class="text">
          {{ $t('帮助') }}
        </span>
      </LiveChat>
    </RxButton>

    <RxInputSelect v-model="currentLocale" name="language" :options="ISO639" :filter="false" class="md:w-36" />

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
    line-height: var(--Line-Height-text-lg, 20px);

    .live-chat {
      display: flex;
      justify-content: center;
      align-items: center;
      gap: var(--spacing-md, 6px);
    }
  }
}
</style>
