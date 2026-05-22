<script setup lang="ts">
// import { getUserAgentOs } from '/@/utils'
import { useOnboardingTaskStatus } from '/@/views/tutorial/hooks.ts'
import { useCommonUtil } from '/@/layout/components/header/profile/components/settings-popup/useCommonUtil'

defineProps<{
  count: number
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'confirm', value: 'grid' | 'stack' | (string & {})): void
}>()

const { saveUserConfig } = useCommonUtil()
const { updateOnboardingTaskStatus } = useOnboardingTaskStatus()

const cid = useId()

const notRemind = ref(false)

const layoutMode = [
  {
    label: $t('网格'),
    img: 'other/grid',
    value: 'grid',
  },
  {
    label: $t('堆叠'),
    img: 'other/stack',
    value: 'stack',
  },
]

const activeLayoutMode = ref(layoutMode[0].value)

// const shortcut = computed(() => {
//   return getUserAgentOs() === 'macOS' ? '(Cmd+Option+K)' : '(Ctrl+Alt+K)'
// })

function handleNotRemind() {
  if (notRemind.value) {
    updateOnboardingTaskStatus({ batchOpenWindowNoPromptStatus: true })
    saveUserConfig({ name: 'batchOpenLayout', value: activeLayoutMode.value })
  }
}

function onClose() {
  handleNotRemind()
  emit('close')
}

function onConfirm() {
  handleNotRemind()
  emit('confirm', activeLayoutMode.value)
}
</script>

<template>
  <div class="w-120 flex flex-col gap-4 pa-6 pt-4 rounded-2">
    <div class="h-9 flex items-center justify-between">
      <div class="tt-primary text-4 font-600 leading-normal">
        {{ $t('打开并排列 {count} 个窗口', { count }) }}
      </div>
      <SvgIcon class="cursor-pointer" name="base/rx_ic_delete" size="20" color="var(--colors-icon-icon-secondary)" @click="onClose" />
    </div>
    <div class="flex flex-col self-stretch gap-4">
      <div class="tt-primary text-3.5 leading-4">
        {{ $t('请选择您的窗口布局') }}
      </div>
      <div class="flex gap-4">
        <div v-for="item in layoutMode" :key="item.value" class="flex-1 flex flex-col gap-3 items-center justify-center" :class="{ active: activeLayoutMode === item.value }">
          <div class="self-stretch py-3.5 px-5.5 rounded-2 cursor-pointer radio" @click="activeLayoutMode = item.value">
            <SvgIcon :name="(item.img as any)" class="block mx-auto icon" size="64" />
          </div>
          <div class="text">
            {{ item.label }}
          </div>
        </div>
      </div>
      <!-- <div v-if="activeLayoutMode === 'grid'" class="tt-inactive text-3 leading-4.5 whitespace-pre-line">
        {{ $t('* 打开窗口后，您也可以使用快捷键 {shortcut} 重新进行网格排列。', { shortcut }) }}
      </div> -->

      <div class="mt-4 flex gap-3 items-center">
        <div class="flex-1 flex items-center gap-2">
          <RxCheckbox v-model="notRemind" :input-id="cid" name="pizza" value="Cheese" />
          <label class="tt-secondary text-3" :for="cid"> {{ $t('不再提醒') }} </label>
        </div>
        <RxButton :label="$t('取消')" size="md" outlined severity="secondary" @click="onClose" />
        <RxButton :label="$t('确认')" size="md" @click="onConfirm" />
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.radio {
  border: 1px solid var(--colors-border-border-subtle, #c7d1d6);
  background: var(--colors-background-bg-action, #fff);
}

.text {
  color: var(--colors-text-text-tertiary);
  font-size: 14px;
  line-height: 16px;
}

.icon {
  color: var(--colors-icon-icon-tertiary);
}

.active {
  .radio {
    border: 2px solid var(--colors-border-border-brand);
    background: rgba(17, 163, 253, 0.2);
  }

  .text {
    color: var(--colors-text-text-brand);
  }

  .icon {
    color: var(--colors-icon-icon-brand);
  }
}
</style>
