<script setup lang="ts">
import type { MyTemplateKind } from '../../my-templates'
import AgentFormField from '../form/AgentFormField.vue'

withDefaults(defineProps<{
  templateType: MyTemplateKind
  /** full = 名称+类型+内容区；content = 仅内容区（用于来源列表加载时） */
  scope?: 'full' | 'content'
}>(), {
  scope: 'content',
})
</script>

<template>
  <template v-if="scope === 'full'">
    <AgentFormField :label="$t('模板名称')">
      <Skeleton width="100%" height="32px" border-radius="10px" />
    </AgentFormField>

    <AgentFormField :label="$t('模板内容')">
      <div class="ctf-skeleton__types">
        <Skeleton v-for="i in 3" :key="i" width="100%" height="32px" border-radius="10px" />
      </div>
    </AgentFormField>
  </template>

  <section v-if="templateType !== 'prompt'" class="ctf-skeleton__content-panel" aria-hidden="true">
    <AgentFormField :label="templateType === 'script' ? $t('选择脚本') : $t('选择 Skill')">
      <div class="ctf-skeleton__source-row">
        <Skeleton width="100%" height="32px" border-radius="10px" />
        <Skeleton width="96px" height="32px" border-radius="10px" />
      </div>
    </AgentFormField>

    <div class="ctf-skeleton__details">
      <div class="ctf-skeleton__details-title">
        <Skeleton width="80px" height="14px" border-radius="4px" />
        <Skeleton width="40px" height="12px" border-radius="4px" />
      </div>
      <Skeleton width="100%" height="14px" border-radius="4px" />
      <Skeleton width="68%" height="14px" border-radius="4px" />
    </div>

    <div v-if="templateType === 'script'" class="ctf-skeleton__parameters">
      <div class="ctf-skeleton__details-title">
        <Skeleton width="64px" height="14px" border-radius="4px" />
        <Skeleton width="56px" height="12px" border-radius="4px" />
      </div>
      <div class="ctf-skeleton__parameter-fields">
        <div class="ctf-skeleton__parameter-field">
          <Skeleton width="72px" height="14px" border-radius="4px" />
          <Skeleton width="100%" height="32px" border-radius="10px" />
        </div>
        <div class="ctf-skeleton__parameter-field">
          <Skeleton width="56px" height="14px" border-radius="4px" />
          <Skeleton width="100%" height="32px" border-radius="10px" />
        </div>
      </div>
    </div>

    <AgentFormField v-else>
      <template #label>
        <div class="ctf-skeleton__prompt-label">
          <Skeleton width="48px" height="14px" border-radius="4px" />
          <Skeleton width="120px" height="12px" border-radius="4px" />
        </div>
      </template>
      <Skeleton width="100%" height="76px" border-radius="10px" />
    </AgentFormField>
  </section>

  <AgentFormField v-else-if="scope === 'full'" :label="$t('提示词内容')">
    <Skeleton width="100%" height="176px" border-radius="10px" />
  </AgentFormField>
</template>

<style lang="scss" scoped>
.ctf-skeleton__types {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
}

.ctf-skeleton__content-panel {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 16px;
  padding: 12px;
  border: 1px solid var(--color-border-secondary);
  border-radius: 12px;
  background: var(--color-bg-tertiary);
}

.ctf-skeleton__source-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
}

.ctf-skeleton__details {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px;
  border: 1px solid var(--color-border-primary);
  border-radius: 10px;
  background: transparent;
}

.ctf-skeleton__details-title {
  display: flex;
  align-items: center;
  gap: 4px;
}

.ctf-skeleton__parameters {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 6px;
}

.ctf-skeleton__parameter-fields {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 12px;
}

.ctf-skeleton__parameter-field {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 6px;
}

.ctf-skeleton__prompt-label {
  display: flex;
  align-items: center;
  gap: 6px;
}

@media (max-width: 520px) {
  .ctf-skeleton__types {
    grid-template-columns: 1fr;
  }

  .ctf-skeleton__source-row {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
