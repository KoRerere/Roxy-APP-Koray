<script setup lang="ts">
import { getDefaultWindowName } from '../utils'
import rxEditDiv from '/@/components/rx-edit-div'

const windowName = defineModel<string>()
const defaultWindowName = getDefaultWindowName()


function handleWindowNameInputBlur() {
  if (windowName.value?.trim() === '') {
    windowName.value = defaultWindowName
  }
}

function handleWindowNameStartEdit() {
  if (windowName.value?.startsWith(defaultWindowName)) {
    windowName.value = ''
  }
}
</script>

<template>
  <rxEditDiv v-model="windowName" @blur="handleWindowNameInputBlur" @startEdit="handleWindowNameStartEdit" />
</template>
