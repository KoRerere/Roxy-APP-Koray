<script setup lang="ts">
import RxTooltip from '/@/components/rx-tooltip'
import { chunk } from 'es-toolkit'

interface Avatar {
  avatar?: string
  name?: string
  color?: string
  more?: boolean
}

interface Props extends Avatar {
  list?: Avatar[]
  max?: number
  size?: number
  fontSize?: number
  radius?: string
}

const { list, max, size = 32, fontSize = 16, radius = '50%', ...avatar } = defineProps<Props>()

const avatars = computed(() => {
  const _list = list || [avatar]

  return max && _list.length > max
    ? {
        icons: _list.slice(0, max).concat({ name: `+${_list.length - max}`, color: '#7ECCFC', more: true }),
        surplus: chunk(_list.slice(max), 6),
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
      <img v-if="item.avatar" draggable="false" :class="classes.image" :style="_style" :src="item.avatar">
      <component :is="item.more ? RxTooltip : 'div'" v-else :class="[classes.image, classes.text]" :style="{ ..._style, backgroundColor: item.color }">
        <template #default>
          {{ item.name?.toLocaleUpperCase() }}
        </template>
        <template #content>
          <div class="flex flex-col gap-2">
            <div v-for="(surplus, index) in avatars.surplus" :key="index" class="relative flex items-center cursor-default">
              <template v-for="sub in surplus" :key="sub.name">
                <img v-if="sub.avatar" :class="classes.image" :style="_style" :src="sub.avatar">
                <div v-else :class="[classes.image, classes.text]" :style="{ ..._style, backgroundColor: sub.color }">
                  {{ sub.name?.toLocaleUpperCase() }}
                </div>
              </template>
            </div>
          </div>
        </template>
      </component>
    </template>
    <slot />
  </div>
</template>

<style lang="scss" module="classes">
.image {
  object-fit: cover;
}

.image + .image {
  margin-left: -4px;
}

.text {
  display: block;
  text-align: center;
  color: #fff;
  font-family: 'JetBrains Mono';
  font-weight: 500;
}
</style>
