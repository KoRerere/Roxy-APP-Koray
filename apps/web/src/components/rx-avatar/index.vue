<script setup lang="ts">
interface Avatar {
  avatar?: string
  name?: string
  color?: string
}

interface Props extends Avatar {
  list?: Avatar[]
  max?: number
  size?: number
  fontSize?: number
  radius?: string
}

const { list, max, size = 32, fontSize = 16, radius = '50%', ...avatar } = defineProps<Props>()

const _size = computed(() => `${size}px`)
const _fontSize = computed(() => `${fontSize}px`)

const avatars = computed(() => {
  const _list = list || [avatar]

  return max && _list.length > max
    ? _list.slice(0, max).concat({ name: `+${_list.length - max}`, color: '#7ECCFC' })
    : _list
})
</script>

<template>
  <div class="flex items-center relative">
    <template v-for="(item, index) in avatars" :key="index">
      <img v-if="item.avatar" class="avatar" :src="item.avatar">
      <div v-else class="avatar text-avatar" :style="{ backgroundColor: item.color }">
        {{ item.name?.toLocaleUpperCase() }}
      </div>
    </template>
    <slot />
  </div>
</template>

<style lang="scss" scoped>
.avatar {
  width: v-bind(_size);
  height: v-bind(_size);
  border-radius: v-bind(radius);
  object-fit: cover;
}

.text-avatar {
  line-height: v-bind(_size);
  font-size: v-bind(_fontSize);
  text-align: center;
  color: #fff;
  font-family: 'JetBrains Mono';
  font-weight: 500;
}

.avatar+.avatar {
  margin-left: -4px;
}
</style>
