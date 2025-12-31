<script setup lang="ts">
import TsFormInputText from '/@/views/lab/components/form/m-input-text.vue'

import RoleSplit from './role-split.vue'
import type { Role } from '/@/enums'

defineOptions({
  inheritAttrs: false,
})

const modelValue = defineModel<string>()
const roleModelValue = defineModel<Role>('role')
</script>

<template>
  <div class="relative">
    <TsFormInputText class="w-full" v-bind="$attrs" v-model="modelValue" pre-icon="base/rx_ic_mail" size="md" :placeholder="$t('请输入邮箱地址')"></TsFormInputText>
    <div class="absolute position-y-center right-2">
      <RoleSplit v-model="roleModelValue"></RoleSplit>
    </div>
  </div>
</template>

<style lang="scss" scoped></style>
