<script setup lang="ts">
import Score from './score.vue'
import Reward from './reward.vue'
import Thanks from './thanks.vue'

defineProps<{
  onClose: () => void | Promise<void>
}>()

const step = ref<'score' | 'reward' | 'thanks'>('score')
</script>

<template>
  <Score v-if="step === 'score'" @close="onClose" @submit="step = $event" />
  <Reward v-if="step === 'reward'" @close="onClose" />
  <Thanks v-if="step === 'thanks'" @close="onClose" />
</template>

<style lang="scss" scoped></style>
