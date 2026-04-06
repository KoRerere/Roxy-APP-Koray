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

// 默认背景色，使用 config-base 中 step2 的颜色
const defaultBgColor = '#4c6ffb'
</script>

<template>
  <div class="content-stretch flex flex-col gap-[12px] items-start relative shrink-0 w-full">
    <!-- Title -->
    <template v-if="props.title">
      <div class="flex flex-col font-bold justify-center not-italic relative shrink-0 text-[16px] text-[var(--colors-text-text-primary,#111213)] w-full">
        <p class="leading-[normal] my-0">
          {{ title }}
        </p>
      </div>
    </template>

    <!-- Steps container -->
    <template v-if="props.steps || props.permissions">
      <div class="bg-[var(--colors-background-bg-block)] content-stretch flex flex-col items-start overflow-clip p-[24px] relative rounded-[16px] shrink-0 w-full">
        <div class="content-stretch flex flex-col gap-[var(--spacing-2xl,16px)] items-start relative shrink-0 w-full">
          <!-- Steps -->
          <template v-if="props.steps">
            <div
              v-for="(step, index) in props.steps"
              :key="index"
              class="content-stretch flex gap-3 relative shrink-0 w-full"
            >
              <!-- Step number -->
              <div
                class="content-stretch flex flex-col items-center justify-center relative rounded-[var(--radius-full,9999px)] shrink-0 size-[24px] -translate-y-0.5"
                :style="{ backgroundColor: props.stepNumberBgColor || defaultBgColor }"
              >
                <div class="font-bold justify-center shrink-0 text-12px text-white whitespace-nowrap">
                  {{ step.number || index + 1 }}
                </div>
              </div>

              <!-- Step content -->
              <div class="justify-center text-13px text-[var(--colors-text-text-primary)] w-[616px] items-center leading-[1.5]">
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

    <p v-if="props.isIntegrate" class="my-0 text-left w-full text-3 text-[var(--colors-text-text-tertiary)]">
      * 请开启全局代理 / TUN 模式，以确保网络环境一致
    </p>
  </div>
</template>
