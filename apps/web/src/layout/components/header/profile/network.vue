<script setup lang="tsx">
import type { UserConfig } from './type'

const props = defineProps({
  data: {
    type: Object as PropType<UserConfig>,
    default: undefined,
  },
})

const list = ref()

function getList() {
  return [
    {
      title: 'Network detection',
      items: [
        {
          props: {
            label: 'Use system proxy for connection',
            name: 'language',
            text: 'Use system proxy',
          },
          component: () => {
            return (
              <div>111</div>
            )
          },
        },
        {
          props: {
            label: 'Detect local network',
            name: 'timeZone',
            text: 'Some hints',
          },
          component: () => {
            return (
              <div>222</div>
            )
          },
        },
        {
          props: {
            label: 'Detect system network',
            text: 'Some hints',
            value: null,
          },
          component: () => {
            return (
              <div>333</div>
            )
          },
        },
        {
          props: {
            label: 'Detect system network',
            text: 'Some hints',
            value: null,
          },
          component: () => {
            return (
              <div>444</div>
            )
          },
        },
      ],
    },
  ]
}

watch(() => props.data, () => {
  list.value = getList()
})
</script>

<template>
  <div class="w-full">
    <div class="title">
      Network
    </div>
    <div class="description">
      Manage anything related to network, including whitelist, IP checker
    </div>
    <template v-for="subitem in list" :key="subitem.title">
      <div>{{ subitem.title }}</div>
      <div v-for="item in subitem.items" :key="item.props.label">
        <component :is="item.component" />
      </div>
    </template>
  </div>
</template>

<style lang="scss" scoped>
.title {
  color: #000;
  font-size: 18px;
  font-weight: 600;
  line-height: var(--Line-Height-text-xl, 24px);
}

.description {
  color: var(--Colors-Text-text-secondary, #575d61);
  font-size: 12px;
  line-height: normal;
}
</style>
