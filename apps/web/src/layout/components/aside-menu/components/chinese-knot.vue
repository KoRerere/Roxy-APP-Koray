<script setup lang="ts">
import { RxSvgIcon } from '/@/components/rx-icon';

const emit = defineEmits(['pull-up', 'drop-down'])

const chineseKnotRef = useTemplateRef('chineseKnot')

const keyframes: Keyframe[] = [
  { transform: 'translateY(0)' },
  { transform: 'translateY(65px)' },
  { transform: 'translateY(53px)' },
]

const keyframeOptions: KeyframeAnimationOptions = {
  duration: 400,
  iterations: 1,
  easing: 'ease-out',
  fill: 'forwards',
  direction: 'normal',
}

/** 下拉 */
function dropDown() {
  keyframeOptions.direction = 'normal'
  chineseKnotRef.value?.animate(keyframes, keyframeOptions)
}

/** 收起 */
function pullUp() {
  keyframeOptions.direction = 'reverse'
  chineseKnotRef.value?.animate(keyframes, keyframeOptions)
  setTimeout(() => {
    emit('pull-up')
  }, 300)
}

function handleBallClick() {
  pullUp()
}
onMounted(() => {
  setTimeout(() => {
    dropDown()
  }, 1000)
})

defineExpose({
  pullUp,
  dropDown
})
</script>

<template>
  <div ref="chineseKnot" class="chinese-knot">
    <div class="line" />
    <div class="ball" @click="handleBallClick" :title="$t('恭祝2025年新春快乐！')">
      <RxSvgIcon name="base/chinese-knot" size="24px" />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.chinese-knot {
  position: fixed;
  top: -130px;
  left: 195px;
  z-index: 999;
  user-select: none;
  -webkit-user-drag: none;
}

.line {
  width: 2px;
  height: 100px;
  background-color: #FFB700;
}

.ball {
  position: relative;
  top: -2px;
  left: -11px;
  cursor: pointer;
}
</style>
