<script setup lang="ts">
import type { UserConfig } from './type'

const props = defineProps({
  data: {
    type: Object as PropType<UserConfig>,
    default: undefined,
  },
})

const list = ref()

function getList() {
  const $dict_map = JSON.parse(localStorage.getItem('$dict_map') ?? '{}')
  return [
    {
      title: 'Interface',
      items: [
        {
          label: 'Language',
          name: 'language',
          text: 'Not your language include? <span class="text-blue">Contact us</span>',
          value: props.data?.language,
          options: [
            { label: 'New York', value: 'NY' },
            { label: 'London', value: 'LDN' },
            { label: 'Paris', value: 'PRS' },
          ],
        },
        {
          label: 'Timezone',
          name: 'timezone',
          text: 'Some hints for you',
          value: props.data?.timeZone,
          options: $dict_map.timeZone,
        },
        {
          label: 'Appearance',
          text: 'Themes for different mode',
          value: null,
          options: [
            { label: 'London', value: 'LDN' },
            { label: 'London', value: 'LDN' },
            { label: 'Paris', value: 'PRS' },
          ],
        },
      ],
    },
    {
      title: 'Local Settings',
      items: [
        {
          label: 'Cash Folder Directory',
          text: 'Where to store your cash files in roxy',
          name: 'cacheDir',
          value: props.data?.cacheDir,
          options: [
            { label: 'Istanbul', value: 'IST' },
            { label: 'London', value: 'LDN' },
            { label: 'Paris', value: 'PRS' },
          ],
        },
      ],
    },
    {
      title: 'Behavior',
      items: [
        {
          label: 'Close Button',
          text: 'Behavior while click the close button',
          name: 'closeSoft',
          value: props.data?.closeSoft,
          options: [
            { label: 'Popup tips', value: 'pop' },
            { label: 'Hide client', value: 'min' },
            { label: 'Close client', value: 'exit' },
          ],
        },
      ],
    },
  ]
}

watch(() => props.data, (value) => {
  console.log('🚀 ~ watch ~ value:', value)

  list.value = getList()
})
</script>

<template>
  <div class="w-full preferences">
    <div>
      <div class="title">
        Preferences
      </div>
      <div class="description">
        Manage client experience settings. Including languages and appearance.
      </div>
    </div>

    <div v-for="item in list" :key="item.title">
      <div class="mb-3">
        {{ item.title }}
      </div>
      <div v-for="subItem in item.items" :key="subItem.label" class="inputs">
        <div class="inputs-label">
          {{ subItem.label }}
        </div>
        <div class="inputs-text" v-html="subItem.text" />
        <Select v-model="subItem.value" class="inputs-input" :options="subItem.options" option-label="label"
          option-value="value" />
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.preferences {
  display: flex;
  flex-direction: column;
  gap: var(--oversize-spacing-3rem, 48px);
}

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

.inputs {
  display: grid;
  align-items: center;
  grid-template-columns: 1fr 220px;
  grid-template-areas:
    'left-top right'
    'left-bottom right';
  padding: var(--spacing-2xl, 16px) 0px;
  border-bottom: 0.5px solid var(--Colors-Border-border-container, #c7cdd1);

  &-label {
    grid-area: left-top;
    color: #000;
    font-size: 12px;
    font-weight: 500;
    line-height: normal;
  }

  &-text {
    grid-area: left-bottom;
    color: var(--Colors-Text-text-tertiary, #7c8387);
    font-size: 10px;
    line-height: var(--Line-Height-text-xs, 16px);
  }

  &-input {
    grid-area: right;
    width: 100%;
  }
}
</style>
