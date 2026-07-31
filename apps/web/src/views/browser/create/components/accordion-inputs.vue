<script lang="ts" setup>
import type { Accordions } from './type.ts'
import WindowFormRenderer from './window-form-renderer.vue'

interface Props {
  accordions?: Accordions
  inputsGroup?: any[][]
}

const props = withDefaults(defineProps<Props>(), {
  inputsGroup: () => [],
})

const outsidePanels = computed(() => props.accordions?.panels.filter(panel => panel.placement === 'outside') ?? [])
const accordionPanels = computed(() => props.accordions?.panels.filter(panel => panel.placement === 'accordion') ?? [])
</script>

<template>
  <div class="flex-ovh-1 min-h-0 min-w-0 w-full flex-col">
    <div v-if="props.accordions" class="content min-h-0 min-w-0 flex-1 overflow-y-auto pb-4">
      <slot name="before" />
      <WindowFormRenderer
        v-for="panel in outsidePanels"
        :key="panel.value"
        class="px-4"
        :inputs="props.inputsGroup[panel.groupIndex]"
        :inputs-group="props.inputsGroup"
        :variant="panel.variant"
        :excluded-fields="panel.excludedFields"
      />
      <RxAccordion :value="props.accordions.value" multiple>
        <AccordionPanel v-for="panel in accordionPanels" :key="panel.value" :value="panel.value" :pt="{ root: '!border-dashed' }">
          <AccordionHeader v-slot="{ active }" as="div">
            <div class="flex items-center gap-3 header">
              <SvgIcon class="header-icon" :name="active ? 'base/rx_ic_minus' : 'base/rx_ic_plus'" size="20" />
              <span>{{ panel.title }}</span>
            </div>
          </AccordionHeader>
          <AccordionContent>
            <WindowFormRenderer
              :inputs="props.inputsGroup[panel.groupIndex]"
              :inputs-group="props.inputsGroup"
              :variant="panel.variant"
              :excluded-fields="panel.excludedFields"
            />
          </AccordionContent>
        </AccordionPanel>
      </RxAccordion>
    </div>
  </div>
</template>

<style lang="scss" scoped>
:deep(.p-accordionpanel) {
  min-width: 0;
  max-width: 100%;
}

// 高度过渡期间外层小于内容高度，overflow:auto 会闪出滚动条；统一 hidden 并在展开后由容器撑开
:deep(.p-accordioncontent) {
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
}

:deep(.p-accordioncontent-content),
:deep(.p-accordioncontent-wrapper) {
  min-width: 0;
  max-width: 100%;
}

:deep(.p-accordionheader) {
  padding: 24px 16px;
}

.content {
  scrollbar-width: none;
  -ms-overflow-style: none;

  &::-webkit-scrollbar {
    display: none;
  }
}

.header {
  color: var(--colors-text-text-primary);
  font-size: 16px;
  font-weight: 600;
  line-height: 16px;

  &-icon {
    border: 1px solid var(--colors-border-border-base);
    border-radius: 4px;
    padding: 2px;
    background: var(--colors-background-bg-action);
  }
}
</style>
