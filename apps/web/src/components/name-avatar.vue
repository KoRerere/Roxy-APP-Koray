<script setup lang="ts">
const props = defineProps({
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
  <div class="avatar">
    {{ name?.toLocaleUpperCase() }}
  </div>
</template>

<style lang="scss" scoped>
.avatar {
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
