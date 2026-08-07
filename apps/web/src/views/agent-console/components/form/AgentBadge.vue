<script setup lang="ts">
import type { SvgNames } from '/@/components/rx-icon'

type BadgeType = 'completed' | 'default' | 'open' | 'prompt' | 'running' | 'scheduled' | 'script' | 'skill' | 'window'

interface BadgeConfig {
  className: string
  icon?: SvgNames
  label: string
}

const props = withDefaults(defineProps<{
  icon?: SvgNames
  label?: string
  type?: BadgeType
}>(), {
  type: 'default',
})

const badgeConfig = computed<BadgeConfig>(() => {
  const configs: Record<BadgeType, BadgeConfig> = {
    default: {
      className: 'agent-badge--default',
      label: 'badge',
    },
    open: {
      className: 'agent-badge--open',
      label: 'badge',
    },
    scheduled: {
      className: 'agent-badge--scheduled',
      label: 'badge',
    },
    running: {
      className: 'agent-badge--running',
      label: 'badge',
    },
    completed: {
      className: 'agent-badge--completed',
      label: 'badge',
    },
    skill: {
      className: 'agent-badge--skill',
      icon: 'base/rx_ic_skills_store',
      label: 'Skill',
    },
    script: {
      className: 'agent-badge--script',
      icon: 'base/rx_ic_doc_code',
      label: 'Script',
    },
    prompt: {
      className: 'agent-badge--prompt',
      icon: 'base/rx_ic_template',
      label: 'Prompt',
    },
    window: {
      className: 'agent-badge--window',
      icon: 'base/rx_ic_browser',
      label: 'Window',
    },
  }

  return configs[props.type]
})

const isStatusBadge = computed(() => ['completed', 'default', 'running', 'scheduled'].includes(props.type))
const iconName = computed(() => props.icon ?? badgeConfig.value.icon)
const labelText = computed(() => props.label ?? badgeConfig.value.label)
</script>

<template>
  <span class="agent-badge" :class="[badgeConfig.className, { 'agent-badge--status': isStatusBadge }]">
    <span v-if="isStatusBadge" class="agent-badge__dot" aria-hidden="true" />
    <slot v-else name="icon">
      <SvgIcon v-if="iconName" class="agent-badge__icon" :name="iconName" size="16" aria-hidden="true" />
    </slot>
    <span class="agent-badge__label">
      <slot>{{ labelText }}</slot>
    </span>
  </span>
</template>

<style scoped lang="scss">
.agent-badge {
  display: inline-flex;
  max-width: 100%;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 2px 6px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 400;
  line-height: 20px;
  vertical-align: middle;
  white-space: nowrap;
}

.agent-badge--status {
  padding-right: 8px;
  border: 1px solid var(--color-border-secondary);
  border-radius: 26px;
  background: transparent;
}

.agent-badge__dot {
  width: 6px;
  height: 6px;
  flex: 0 0 6px;
  border-radius: 9999px;
  background: currentColor;
}

.agent-badge__icon {
  flex: 0 0 16px;
}

.agent-badge__label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

.agent-badge--default {
  color: var(--color-text-primary);
}

.agent-badge--scheduled {
  color: var(--color-text-blue);
}

.agent-badge--completed {
  color: var(--color-text-success-primary);
}

.agent-badge--running {
  color: transparent;
  background-clip: padding-box;

  .agent-badge__dot {
    background: var(--agent-gradient, linear-gradient(127deg, #3faaf6 10.127%, #f359dc 44.937%, #f28fb0 100%));
  }

  .agent-badge__label {
    background: var(--agent-gradient, linear-gradient(127deg, #3faaf6 10.127%, #f359dc 44.937%, #f28fb0 100%));
    background-clip: text;
    -webkit-text-fill-color: transparent;
  }
}

.agent-badge--skill {
  color: var(--color-text-tag-pink);
  background: var(--color-bg-tag-pink);
}

.agent-badge--script {
  color: var(--color-text-tag-blue);
  background: var(--color-bg-tag-blue);
}

.agent-badge--open {
  padding: 2px 8px;
  border-radius: 40px;
  color: var(--color-text-tag-blue);
  background: var(--color-bg-tag-blue);
}

.agent-badge--prompt {
  color: var(--color-text-tag-warning);
  background: var(--color-bg-tag-warning);
}

.agent-badge--window {
  color: var(--color-text-tag-purple);
  background: var(--color-bg-tag-purple);
}
</style>
