<script setup lang="ts">
interface Step {
  number?: number
  text?: string
  component?: any
  [key: string]: any
}

interface Props {
  title?: string
  steps?: Step[]
  permissions?: string[]
  stepNumberBgColor?: string
  isIntegrate?: boolean
}

const props = defineProps<Props>()

const defaultBgColor = 'var(--color-bg-primary-inverse)'
</script>

<template>
  <div class="step-guide">
    <!-- Title -->
    <template v-if="props.title">
      <h2>{{ title }}</h2>
    </template>

    <!-- Steps container -->
    <template v-if="props.steps || props.permissions">
      <div class="step-guide__panel">
        <div class="step-guide__list">
          <!-- Steps -->
          <template v-if="props.steps">
            <div
              v-for="(step, index) in props.steps"
              :key="index"
              class="step-guide__item"
            >
              <!-- Step number -->
              <div
                class="step-guide__number"
                :style="{ backgroundColor: props.stepNumberBgColor || defaultBgColor }"
              >
                {{ step.number || index + 1 }}
              </div>

              <!-- Step content -->
              <div class="step-guide__content">
                <!-- Component content -->
                <template v-if="step.component">
                  <component :is="step.component" :step="step" :index="index" />
                </template>

                <!-- Slot content -->
                <template v-else>
                  {{ step.text }}
                </template>
              </div>
            </div>
          </template>
        </div>
      </div>
    </template>

    <p v-if="props.isIntegrate" class="step-guide__hint">
      {{ $t('* 请开启全局代理 / TUN 模式，以确保网络环境一致') }}
    </p>
  </div>
</template>

<style lang="scss" scoped>
.step-guide {
  display: flex;
  width: 100%;
  flex-direction: column;
  align-items: flex-start;
  gap: 12px;

  h2 {
    margin: 0;
    color: var(--color-text-primary, #141414);
    font-size: 16px;
    font-weight: 700;
    line-height: normal;
  }
}

.step-guide__panel {
  width: 100%;
  box-sizing: border-box;
  padding: 24px;
  border-radius: 16px;
  background: var(--color-bg-tertiary, #f5f5f5);
  overflow: hidden;
}

.step-guide__list {
  display: flex;
  width: 100%;
  flex-direction: column;
  align-items: flex-start;
  gap: 16px;
}

.step-guide__item {
  display: flex;
  width: 100%;
  align-items: flex-start;
  gap: 12px;
}

.step-guide__number {
  display: flex;
  width: 24px;
  height: 24px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  color: var(--color-text-primary-inverse, #fcfcfc);
  font-size: 12px;
  font-weight: 700;
  line-height: normal;
}

.step-guide__content {
  min-width: 0;
  flex: 1;
  color: var(--color-text-primary, #141414);
  font-size: 14px;
  font-weight: 400;
  line-height: 21px;
}

.step-guide__hint {
  width: 100%;
  margin: 0;
  color: var(--colors-text-text-tertiary, var(--color-text-tertiary, #525252));
  font-size: 12px;
  line-height: 18px;
  text-align: left;
}
</style>
