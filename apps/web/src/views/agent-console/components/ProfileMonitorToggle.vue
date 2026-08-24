<script setup lang="ts">
import AgentTooltip from './AgentTooltip.vue'
import { useProfileMonitorContext } from '../composables/useProfileMonitorContext'

const props = withDefaults(
  defineProps<{
    variant?: 'pill' | 'icon'
  }>(),
  {
    variant: 'pill',
  },
)

const { open, available, runningTaskCount, toggle } = useProfileMonitorContext()
const activityGradientId = `task-monitor-activity-${useId().replace(/[^\w-]/g, '')}`
const activityGradientStroke = `url(#${activityGradientId})`
</script>

<template>
  <div
    v-if="available"
    class="task-monitor-toggle"
    :class="[`task-monitor-toggle--${variant}`, { 'is-running': runningTaskCount > 0 }]"
  >
    <AgentTooltip v-if="variant === 'icon'" :content="$t('窗口监控')" placement="bottom" :offset="8">
      <button
        class="task-monitor-toggle__button"
        :class="{ active: open }"
        type="button"
        :aria-label="$t('窗口监控')"
        @click.stop="toggle"
      >
        <SvgIcon name="roxy-agent/rx-ic-task-monitor" color="var(--color-fg-primary, var(--color-text-primary))" />
        <svg
          v-if="runningTaskCount > 0"
          class="task-monitor-toggle__activity"
          aria-hidden="true"
        >
          <defs>
            <linearGradient :id="activityGradientId" gradientUnits="objectBoundingBox" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stop-color="#1570ef" />
              <stop offset="18%" stop-color="#84caff" />
              <stop offset="38%" stop-color="#7a5af8" />
              <stop offset="60%" stop-color="#ee46bc" />
              <stop offset="78%" stop-color="#fcceee" />
              <stop offset="100%" stop-color="#1570ef" />
              <animateTransform
                attributeName="gradientTransform"
                type="rotate"
                from="0 .5 .5"
                to="360 .5 .5"
                dur="2.4s"
                repeatCount="indefinite"
              />
            </linearGradient>
          </defs>
          <rect :stroke="activityGradientStroke" class="task-monitor-toggle__activity-path" pathLength="100" />
        </svg>
      </button>
    </AgentTooltip>

    <button
      v-else
      class="task-monitor-toggle__button"
      :class="{ active: open }"
      type="button"
      :aria-label="$t('窗口监控')"
      @click.stop="toggle"
    >
      <SvgIcon name="roxy-agent/rx-ic-task-monitor" color="var(--color-fg-primary, var(--color-text-primary))" />
      <span>{{ $t('窗口监控') }}</span>
      <svg
        v-if="runningTaskCount > 0"
        class="task-monitor-toggle__activity"
        aria-hidden="true"
      >
        <defs>
          <linearGradient :id="activityGradientId" gradientUnits="objectBoundingBox" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#1570ef" />
            <stop offset="18%" stop-color="#84caff" />
            <stop offset="38%" stop-color="#7a5af8" />
            <stop offset="60%" stop-color="#ee46bc" />
            <stop offset="78%" stop-color="#fcceee" />
            <stop offset="100%" stop-color="#1570ef" />
            <animateTransform
              attributeName="gradientTransform"
              type="rotate"
              from="0 .5 .5"
              to="360 .5 .5"
              dur="2.4s"
              repeatCount="indefinite"
            />
          </linearGradient>
        </defs>
        <rect :stroke="activityGradientStroke" class="task-monitor-toggle__activity-path" pathLength="100" />
      </svg>
    </button>
  </div>
</template>

<style lang="scss" scoped>
.task-monitor-toggle {
  position: absolute;
  top: 18px;
  right: calc(clamp(16px, 2vw, 18px) + var(--task-monitor-toggle-inline-offset, 0px));
  z-index: 8;
}

.task-monitor-toggle--icon {
  width: 32px;
  height: 32px;

  :deep(.agent-tooltip__trigger) {
    display: block;
  }
}

.task-monitor-toggle__button {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 999px;
  color: var(--color-text-primary);
  box-shadow: none;
  cursor: pointer;
  font-family: inherit;
  overflow: visible;
}

.task-monitor-toggle__activity {
  position: absolute;
  inset: -2px;
  z-index: 1;
  width: calc(100% + 4px);
  height: calc(100% + 4px);
  overflow: visible;
  pointer-events: none;
}

.task-monitor-toggle__activity-path {
  x: 1px;
  y: 1px;
  width: calc(100% - 2px);
  height: calc(100% - 2px);
  rx: 17px;
  ry: 17px;
  fill: none;
  opacity: 0.9;
  stroke-dasharray: 100 0;
  stroke-linecap: round;
  stroke-width: 0.6;
  vector-effect: non-scaling-stroke;
}

.task-monitor-toggle--pill .task-monitor-toggle__button {
  min-height: 32px;
  gap: 4px;
  padding: 6px 10px 6px 8px;
  border: 1px solid var(--color-border-secondary);
  background: var(--color-bg-primary);
  font-size: 14px;
  font-weight: 400;
  line-height: 20px;
  white-space: nowrap;

  &:hover {
    background: var(--color-bg-secondary-hover);
  }
}

.task-monitor-toggle--icon .task-monitor-toggle__button {
  width: 32px;
  height: 32px;

  &:hover {
    background: var(--color-bg-secondary-hover);
  }
}

.task-monitor-toggle__glyph {
  position: relative;
  flex: 0 0 auto;
  border: 1.5px solid currentColor;
}

.task-monitor-toggle--pill .task-monitor-toggle__glyph {
  width: 16px;
  height: 16px;
  border-radius: 4px;
}

.task-monitor-toggle--icon .task-monitor-toggle__glyph {
  width: 14px;
  height: 14px;
  border-radius: 3px;
}

.task-monitor-toggle__glyph::before,
.task-monitor-toggle__glyph::after {
  position: absolute;
  content: '';
  background: currentColor;
}

.task-monitor-toggle__glyph::before {
  width: 1.5px;
  border-radius: 999px;
}

.task-monitor-toggle--pill .task-monitor-toggle__glyph::before {
  top: 4px;
  bottom: 4px;
  left: 6px;
}

.task-monitor-toggle--icon .task-monitor-toggle__glyph::before {
  top: 3px;
  bottom: 3px;
  left: 5px;
}

.task-monitor-toggle__glyph::after {
  border-radius: 999px;
}

.task-monitor-toggle--pill .task-monitor-toggle__glyph::after {
  right: 3px;
  bottom: 4px;
  left: 3px;
  height: 1.5px;
}

.task-monitor-toggle--icon .task-monitor-toggle__glyph::after {
  right: 3px;
  bottom: 3px;
  left: 3px;
  height: 1.5px;
}
</style>
