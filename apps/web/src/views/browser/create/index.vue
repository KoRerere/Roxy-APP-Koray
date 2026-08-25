<script lang="ts" setup>
import SingleCreate from './modes/single-create.vue'
import BatchCreate from './modes/batch-create.vue'
import ImportCreate from './modes/import-create.vue'
import { useCreatePageShared } from './modes/useCreatePageShared'
import { API } from '/@/api'
import { useOpenRoxyAIAgent } from '/@/hooks/useOpenRoxyAIAgent'
import { useSimpleLocale } from '/@/stores/locale'
import { AI_BATCH_CREATE_AGENT_ROUTE } from '/@/views/agent-console/batch-create-prefill'

const shared = useCreatePageShared()
const { tabs, tabsValue } = shared
const simpleLocale = useSimpleLocale()
const { opening: aiAgentOpening, openRoxyAIAgent } = useOpenRoxyAIAgent()
const useWideRecommendationBadge = computed(() => /^(?:en|ru)(?:-|$)/i.test(simpleLocale.currentLocale))

function toAgentBatchCreate() {
  void API.base.userReportAppEventCreate({
    eventName: 'ai_bath_create',
    eventProperties: {},
  }).catch(console.error)
  return openRoxyAIAgent(AI_BATCH_CREATE_AGENT_ROUTE)
}
</script>

<template>
  <div class="relative flex min-h-0 flex-col h-full create-page">
    <ViewsHeader show-back :divider="false" :title="$t('创建窗口')" />
    <RxTabs v-model:value="tabsValue" :tabs="tabs" only-tabs>
      <template #tablist>
        <TabList :pt="{ tablist: 'px-6 py-0 gap-4' }">
          <Tab v-for="tab in tabs" :key="tab.title" :value="tab.value">
            <div class="flex items-center justify-center gap-2">
              <span>{{ tab.title }}</span>
            </div>
          </Tab>
          <button
            class="ai-batch-create-entry"
            :class="{ 'ai-batch-create-entry--wide-badge': useWideRecommendationBadge }"
            type="button"
            :aria-label="$t('AI 批量创建')"
            :disabled="aiAgentOpening"
            @click.stop="toAgentBatchCreate"
          >
            <span class="ai-batch-create-entry__text">{{ $t('AI 批量创建') }}</span>
            <span class="ai-batch-create-entry__badge">{{ $t('推荐') }}</span>
          </button>
        </TabList>
      </template>
    </RxTabs>
    <!-- v-if：避免三份 AccordionInputs 同时挂载同一份 form 状态 -->
    <SingleCreate v-if="tabsValue === 'single'" :shared="shared" />
    <BatchCreate v-else-if="tabsValue === 'multiple'" :shared="shared" />
    <ImportCreate v-else :shared="shared" />
  </div>
</template>

<style lang="scss" scoped>
.ai-batch-create-entry {
  position: relative;
  display: inline-flex;
  height: 32px;
  flex: 0 0 auto;
  align-items: center;
  padding: 8px 22px 8px 8px;
  border: 0;
  outline: none;
  background: transparent;
  cursor: pointer;
  font: inherit;
  white-space: nowrap;

  &__text {
    color: transparent;
    background: linear-gradient(103.72deg, #3faaf6 10.6%, #f359dc 55.3%, #f28fb0 100%);
    background-clip: text;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    font-size: 12px;
    font-weight: 600;
    line-height: 16px;
  }

  &__badge {
    position: absolute;
    top: 2px;
    right: -6px;
    display: inline-flex;
    min-width: 27px;
    height: 13px;
    align-items: center;
    justify-content: center;
    padding: 0;
    border: 0;
    border-radius: 5.5px;
    color: #fff;
    background: linear-gradient(113.67deg, #12a3fc 0%, #c36df4 100%);
    font-family: 'DingTalk JinBuTi', sans-serif;
    font-size: 9px;
    font-weight: 400;
    line-height: 11px;
    white-space: nowrap;
  }

  &:not(:disabled):hover &__text {
    filter: brightness(1.08);
  }

  &:disabled {
    cursor: default;
    opacity: 0.55;
  }
}

.ai-batch-create-entry--wide-badge {
  padding-right: 44px;

  .ai-batch-create-entry__badge {
    right: -14px;
    min-width: 45px;
    padding: 0 4px;
    font-size: 7px;
  }
}

:deep(.guide1.guide1-pulse-active) {
  position: relative;
  z-index: 10001;

  &::after {
    content: '';
    position: absolute;
    inset: 0;
    box-sizing: border-box;
    border-radius: inherit;
    pointer-events: none;
    border: 2px solid rgba(255, 200, 0, 0.85);
    box-shadow: 0 0 0 0 rgba(255, 200, 0, 0);
    animation: guide1-breathe 2.3s ease-in-out infinite;
  }
}

@keyframes guide1-breathe {
  0%,
  100% {
    opacity: 0.3;
    border-color: rgba(255, 200, 0, 0.45);
    box-shadow: 0 0 0 0 rgba(255, 200, 0, 0);
  }

  50% {
    opacity: 1;
    border-color: rgba(255, 200, 0, 0.95);
    box-shadow: 0 0 2px 2px rgba(255, 200, 0, 0.42);
  }
}
</style>
