<script setup lang="ts">
import domAlign from 'dom-align'
import { AnimatePresence, motion } from 'motion-v'

type Trigger = 'click' | 'hover' | 'focus'
type Placement = 'top' | 'bottom' | 'left' | 'right'

const props = defineProps({
  trigger: {
    type: String as PropType<Trigger>,
    default: 'hover',
  },
  placement: {
    type: String as PropType<Placement>,
    default: 'top',
  },
  offset: {
    type: Number,
    default: 4,
  },
  delay: {
    type: Number,
    default: 200,
  },
  tooltipContentClass: {
    type: String,
  },
})

const sourceRef = useTemplateRef<HTMLDivElement>('source')
const targetRef = useTemplateRef<HTMLDivElement>('target')

const slots = useSlots()

const show = ref(false)

const motionShow = ref(false)

const configs = computed(() => {
  const __configs: {
    points?: string[]
    offset?: number[]
    y?: number
    x?: number
  } = {}
  const motionOffset = 8
  if (props.placement === 'top') {
    __configs.points = ['bc', 'tc']
    __configs.offset = [0, -props.offset]
    __configs.y = motionOffset
  }
  else if (props.placement === 'bottom') {
    __configs.points = ['tc', 'bc']
    __configs.offset = [0, props.offset]
    __configs.y = -motionOffset
  }
  else if (props.placement === 'left') {
    __configs.points = ['cr', 'cl']
    __configs.offset = [-props.offset, 0]
    __configs.x = motionOffset
  }
  else if (props.placement === 'right') {
    __configs.points = ['cl', 'cr']
    __configs.offset = [props.offset, 0]
    __configs.x = -motionOffset
  }
  return __configs
})

function align() {
  nextTick(() => {
    if (sourceRef.value && targetRef.value) {
      domAlign(sourceRef.value, targetRef.value, {
        points: configs.value.points,
        offset: configs.value.offset,
        overflow: {
          adjustX: true,
          adjustY: true,
        },
        useCssTransform: true,
      })
    }
  })
}

let delayTimer: NodeJS.Timeout | null = null
function open() {
  // 如果没有传递 slot content 则不显示了
  if (!slots.content)
    return
  show.value = true
  delayTimer = setTimeout(() => {
    motionShow.value = true
    align()
  }, props.delay)
}

function clickToOpen() {
  if (!slots.content)
    return
  show.value = !show.value
  align()
}

let hideTimer: NodeJS.Timeout | null = null
function hide() {
  delayTimer && clearTimeout(delayTimer)
  hideTimer && clearTimeout(hideTimer)
  hideTimer = setTimeout(() => {
    motionShow.value = false
    nextTick(() => show.value = false)
  }, 200)
}

function enterContent() {
  hideTimer && clearTimeout(hideTimer)
}

onMounted(() => {
  const action = props.trigger
  if (action === 'click') {
    targetRef.value?.addEventListener('click', clickToOpen)
  }
  else if (action === 'hover') {
    targetRef.value?.addEventListener('mouseenter', open)
    targetRef.value?.addEventListener('mouseleave', hide)
  }
  else if (action === 'focus') {
    targetRef.value?.addEventListener('focus', open)
    targetRef.value?.addEventListener('blur', hide)
  }

  onUnmounted(() => {
    if (action === 'click') {
      targetRef.value?.removeEventListener('click', clickToOpen)
    }
    else if (action === 'hover') {
      targetRef.value?.removeEventListener('mouseenter', open)
      targetRef.value?.removeEventListener('mouseleave', hide)
    }
    else if (action === 'focus') {
      targetRef.value?.removeEventListener('focus', open)
      targetRef.value?.removeEventListener('blur', hide)
    }
  })
})

defineExpose({
  align,
})
</script>

<template>
  <div ref="target" class="inline-block" v-bind="$attrs">
    <slot :hide="hide" />
  </div>
  <Teleport v-if="show" to="body">
    <div ref="source" class="absolute inline-block z-4000" @mouseenter="enterContent" @mouseleave="hide">
      <AnimatePresence>
        <motion.div v-if="motionShow" class="rx-tooltip-content" :class="tooltipContentClass" :initial="{ opacity: 0, y: configs.y, x: configs.x }"
                    :animate="{ opacity: 1, y: 0, x: 0 }" :exit="{ opacity: 0, y: configs.y, x: configs.x }"
                    :transition="{ duration: 0.15 }"
        >
          <slot name="content" />
        </motion.div>
      </AnimatePresence>
    </div>
  </Teleport>
</template>

<style scoped lang="scss">
:where(.rx-tooltip-content) {
  white-space: pre-line;
  word-break: break-word;
  padding: var(--spacing-xl, 12px);
  border-radius: var(--radius-md, 6px);
  background: var(--component-tooltip-bg, #111213);
  /* shadow-md */
  box-shadow:
    0px 3px 8px 0px rgba(0, 0, 0, 0.07),
    0px 2px 5px 0px rgba(0, 0, 0, 0.07),
    0px 1px 1px 0px rgba(0, 0, 0, 0.07);
}
</style>
