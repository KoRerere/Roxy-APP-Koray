<script setup lang="ts">
import RxTooltip from '/@/components/rx-tooltip'

interface Avatar {
  avatar?: string
  name?: string
  color?: string
  more?: boolean
  tooltip?: string
}

interface Props extends Avatar {
  list?: Avatar[]
  max?: number
  size?: number
  fontSize?: number
  radius?: string
  gap?: number
  compact?: boolean
}

const { list, max, size = 32, fontSize = 16, gap = -4, radius = '50%', compact = false, ...avatar } = defineProps<Props>()

const _gap = computed(() => {
  return CSS.px(gap as number).toString()
})

const avatars = computed(() => {
  const _list = (list || [avatar]).filter(Boolean).map(item => ({
    ...item,
    truncName: item.name?.slice(0, 2).toLocaleUpperCase(),
  }))

  return max && _list.length > max
    ? {
        icons: _list.slice(0, max).concat({ truncName: `+${_list.length - max}`, color: '#7ECCFC', more: true }),
        surplus: _list.slice(max),
      }
    : {
        icons: _list,
        surplus: [],
      }
})

const _style = computed(() => {
  const _size = CSS.px(size).toString()
  const _fontSize = CSS.px(fontSize).toString()
  return {
    width: _size,
    height: _size,
    lineHeight: _size,
    fontSize: _fontSize,
    borderRadius: radius,
  }
})
</script>

<template>
  <div class="relative flex items-center cursor-default">
    <template v-for="item in avatars.icons" :key="item.name">
      <img v-if="item.avatar" v-tooltip.top="item.tooltip" draggable="false" :class="classes.image" :style="_style" :src="item.avatar">
      <component :is="item.more ? RxTooltip : 'div'" v-else :class="[classes.image, classes.text, compact && classes.compact]" :style="{ ..._style, backgroundColor: item.color }" placement="right">
        <template #default>
          <div v-tooltip.top="item.tooltip">
            {{ item.truncName }}
          </div>
        </template>
        <template #content>
          <div class="flex flex-col gap-2 max-h-50 overflow-y-auto" :class="classes.scroll">
            <div v-for="(sub, index) in avatars.surplus" :key="index" class="relative flex items-center gap-1.5 cursor-default">
              <img v-if="sub.avatar" :class="classes.image" :style="_style" :src="sub.avatar">
              <div v-else :class="[classes.image, classes.text, compact && classes.compact]" :style="{ ..._style, backgroundColor: sub.color }">
                {{ sub.truncName }}
              </div>
              <div class="text-3 leading-4 text-white">
                {{ sub.name }}
              </div>
            </div>
          </div>
        </template>
      </component>
    </template>
    <slot />
  </div>
</template>

<style lang="scss" module="classes">
.scroll::-webkit-scrollbar {
  display: none;
}

.image {
  object-fit: cover;
}

.image + .image {
  margin-left: v-bind(_gap);
}

.text {
  display: block;
  text-align: center;
  color: #fff;
  font-family: 'JetBrains Mono';
  font-weight: 500;
}

.compact {
  font-family: Inter, system-ui, sans-serif;
  white-space: nowrap;
  letter-spacing: -0.5px;
}
</style>
