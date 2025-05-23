<script setup lang="ts">
import { getDefaultWindowName } from '../utils'
import rxEditDiv from '/@/components/rx-edit-div'
import { $t } from '/@/locales'

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
  <!-- <Inplace :pt="{ display: 'w-full' }">
    <template #display>
      <div class="flex items-center gap-2.5 text">
        <span>{{ windowName }}</span>
        <SvgIcon name="base/rx_ic_edit" color="#A3A9AD" />
      </div>
    </template>
<template #content="{ closeCallback }">
      <span class="inline-flex items-center gap-2">
        <FloatLabel variant="on">
          <InputText id="on_label" v-model="windowName" autofocus />
          <label for="on_label">{{ defaultWindowName }}</label>
        </FloatLabel>
        <Button icon="pi pi-times" text severity="danger" @click="closeCallback" />
      </span>
    </template>
</Inplace> -->
</template>

<!-- <style scoped lang="scss">
.text {
  position: relative;
  color: var(--primitives-neutrals-600, #575d61);
  font-size: 14px;
  font-weight: 600;
  line-height: normal;
}
</style> -->
