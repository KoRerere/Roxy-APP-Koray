<script lang="ts" setup>
import LiveChat from '/@/components/business/live-chat/index.vue'
import TsFormSelect from '/@/views/lab/components/form/m-input-select.vue'
import { ISO639List } from '/@/constants/iso-639'
import { useSimpleLocale } from '/@/stores/locale'
import { useWindowSize } from '@vueuse/core'
import { isMobile } from '/@/utils'

const { width } = useWindowSize()
const simpleLocale = useSimpleLocale()
const ISO639 = ref(ISO639List)
const currentLocale = ref(ISO639.value.find(item => item.locale === simpleLocale.currentLocale) || ISO639.value[0])
const showDownload = !globalThis.isElectron && !isMobile()

watch(() => currentLocale.value, (val) => {
  simpleLocale.setSimpleLocale(val.locale)
})

function toDownload() {
  const url = simpleLocale.getOfficialWebsite('/download')
  window.open(url, '_blank')
}
</script>

<template>
  <div class="card flex justify-center">
    <RxButton v-if="showDownload" icon="base/rx_ic_download" size="xs" variant="text" severity="secondary" :label="$t('下载客户端')" @click="toDownload" />
    <LiveChat class="live-chat">
      <RxButton icon="base/rx_ic_headphone_2" size="xs" variant="text" severity="secondary" :label="$t('帮助')" />
    </LiveChat>

    <TsFormSelect v-model="currentLocale" :options="ISO639" :filter="false" class="md:w-36" />

    <component is="style" v-if="width > 768">
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
  z-index: 10;

  .help-btn {
    display: flex;
    min-width: 72px;
    padding: var(--spacing-md, 6px) 10px;
    justify-content: center;
    align-items: center;
    gap: var(--spacing-md, 6px);
    color: var(--colors-text-text-primary, #171c1f);
    text-align: center;
    font-family: Inter;
    font-size: 12px;
    font-style: normal;
    font-weight: 500;
    line-height: var(--Line-Height-text-lg, 20px);
    cursor: pointer;

    .live-chat {
      display: flex;
      justify-content: center;
      align-items: center;
      gap: var(--spacing-md, 6px);
      color: white;
    }
  }
}

.help {
  color: var(--colors-text-text-primary);
  font-size: 12px;
  font-weight: 500;
  line-height: 20px;
}
</style>
