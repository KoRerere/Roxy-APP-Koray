<script setup lang="ts">
const props = defineProps({
  avatar: {
    type: String,
    default: undefined,
  },
  name: {
    type: String,
    default: undefined,
  },
  color: {
    type: String,
    default: '#7ECCFC',
  },
  size: {
    type: Number,
    default: 32,
  },
  fontSize: {
    type: Number,
    default: 16,
  },
})
const size = computed(() => `${props.size}px`)
const fontSize = computed(() => `${props.fontSize}px`)
const backgroundColor = computed(() => props.color)
</script>

<template>
  <img v-if="avatar" class="avatar" :src="avatar">
  <div v-else class="name-avatar">
    {{ name?.toLocaleUpperCase() }}
  </div>
</template>

<style lang="scss" scoped>
.avatar {
  width: v-bind(size);
  height: v-bind(size);
  border-radius: 50%;
}

.name-avatar {
  width: v-bind(size);
  height: v-bind(size);
  line-height: v-bind(size);
  font-size: v-bind(fontSize);
  background-color: v-bind(backgroundColor);

  text-align: center;
  color: #fff;
  font-family: 'JetBrains Mono';
  font-weight: 500;
  border-radius: 50%;
}
</style>
