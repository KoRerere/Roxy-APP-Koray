<script setup lang="ts">
import Score from './score.vue'
import Reward from './reward.vue'
import Thanks from './thanks.vue'
import { useOnboardingTaskStatus } from '/@/views/tutorial/hooks.ts'

defineProps<{
  onClose: () => void | Promise<void>
}>()

const { onboardingTaskStatus } = useOnboardingTaskStatus()
const step = ref<'score' | 'reward' | 'thanks'>(onboardingTaskStatus.value?.externalRatingStatus ? 'reward' : 'score')
</script>

<template>
  <Score v-if="step === 'score'" @close="onClose" @submit="step = $event" />
  <Reward v-if="step === 'reward'" @close="onClose" />
  <Thanks v-if="step === 'thanks'" @close="onClose" />
</template>

<style lang="scss" scoped></style>
