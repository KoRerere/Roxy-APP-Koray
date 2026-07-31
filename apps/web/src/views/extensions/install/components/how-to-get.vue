<script setup lang="ts">
import { useExtensionLabels } from '../../utils/extension-labels'

const labels = useExtensionLabels()

const descriptions = computed(() => [
  labels.value.howToGetDesc1,
  labels.value.howToGetDesc2,
])
</script>

<template>
  <div class="flex flex-col gap-2">
    <div class="flex items-center gap-1">
      <SvgIcon name="base/rx_ic_info_fill" :size="12" color="#A3A9AD" />
      <span class="tt-tertiary text-3">{{ labels.googleOnly }}</span>
    </div>
    <RxAccordion>
      <AccordionPanel value="111" :pt="{ root: panel.root }">
        <AccordionHeader v-slot="{ active }" as="div" :pt="{ root: '!py-3 !px-4' }">
          <div class="flex items-center gap-2.5">
            <SvgIcon :class="{ 'rotate-90': active }" class="transition-transform duration-300" name="base/rx_ic_play" size="10" />
            <span class="title">{{ labels.howToGetTitle }}</span>
          </div>
        </AccordionHeader>
        <AccordionContent>
          <div class="w-full flex flex-col gap-2.5 pl-5">
            <div v-for="item in descriptions" :key="item" class="desc">
              {{ item }}
            </div>
            <div class="desc">
              (1) Manifest file format: <a class="link" target="_blank"
                                           href="https://developer.chrome.com/docs/extensions/reference/manifest/"
              >https://developer.chrome.com/docs/extensions/reference/manifest/</a>(update_url)
            </div>
            <div class="desc">
              (2) Distribute your extension: <a class="link" target="_blank"
                                                href="https://developer.chrome.com/docs/extensions/how-to/distribute/"
              >https://developer.chrome.com/docs/extensions/how-to/distribute/</a>
            </div>
            <div class="desc">
              {{ labels.howToGetPracticeNote }}
            </div>
          </div>
        </AccordionContent>
      </AccordionPanel>
    </RxAccordion>
  </div>
</template>

<style scoped module="panel">
.root {
  border: none;
  border-radius: 6px;
  background: var(--colors-background-bg-block);
}
</style>

<style lang="scss" scoped>
.title {
  color: var(--colors-text-text-primary);
  font-size: 12px;
  font-weight: 600;
  line-height: normal;
}

.desc {
  color: var(--colors-text-text-secondary);
  font-size: 12px;
  line-height: normal;
  word-break: break-all;
}

.link {
  color: var(--colors-text-text-brand);
}
</style>
