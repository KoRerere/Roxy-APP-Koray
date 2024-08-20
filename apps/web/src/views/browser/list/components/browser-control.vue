<script setup lang="ts">
import circleProgress from '/@/components/circle-progress.vue'

defineProps({
  state: {
    type: Object,
    default: () => ({}),
  },
})

const emits = defineEmits(['open'])

const State_Enums = {
  Open: 0,
  Loading: 1,
  Error: 2,
}

const _state = reactive({
  state: 0,
  stateText: 'Open',
  progress: 20,
  error: 'this is error msg',
})

const tooltip = computed(() => ({
  value: `${_state.stateText} browser`,
}))

const errorText = computed(() => ({
  value: _state.error,
}))

function openBrowser() {
  // _state.state = State_Enums.Loading
  // _state.stateText = 'Loading'
  // _state.progress = 20
  // setTimeout(() => {
  //   _state.state = State_Enums.Open
  //   _state.stateText = 'Open'
  //   _state.progress = 100
  //   _state.error = ''
  // }, 2000)
  emits('open')
}
</script>

<template>
  <div class="flex gap-2">
    <div v-ripple v-tooltip.top="tooltip" class="flex-cc cursor-pointer open-browser" @click="openBrowser">
      <circle-progress v-if="_state.state === State_Enums.Loading" size="16" :value="_state.progress" />
      <span v-if="_state.state === State_Enums.Open" class="mdi mdi-google-chrome text-4" />
      <span>{{ _state.stateText }}</span>
    </div>
    <span v-if="_state.error" v-tooltip.top="errorText" class="mdi mdi-alert-circle cursor-pointer text-red" />
  </div>
</template>

<style lang="scss" scoped>
.open-browser {
  padding: var(--spacing-sm, 4px) 10px;
  gap: var(--spacing-sm, 4px);

  border-radius: 4px;
  border: 0.5px solid var(--Component-Colors-Buttons-Secondary-border, #c7cdd1);
  background: var(--Component-Colors-Buttons-Secondary-bg, #fff);
  box-shadow:
    0px 4px 4px -1px rgba(0, 0, 0, 0.02),
    0px 1px 1px 0px rgba(0, 0, 0, 0.06);

  color: var(--Color-neutrals-950, #0e1214);
  text-align: center;
  font-family: Inter;
  font-size: var(--Font-Size-text-sm, 12px);
  font-style: normal;
  font-weight: 500;
  line-height: var(--Line-Height-text-xs, 16px);
}
</style>
