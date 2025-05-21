<script setup lang="ts">
import { RxSvgIcon } from '/@/components/rx-icon'
import { $t } from '/@/locales'
import RoleSplit from './role-split.vue'
import type { Role } from '/@/enums'

defineOptions({
  inheritAttrs: false,
})

const modelValue = defineModel<string>()
const roleModelValue = defineModel<Role>('role')
</script>

<template>
  <IconField>
    <InputIcon>
      <RxSvgIcon name="base/rx_ic_mail" />
    </InputIcon>
    <InputText v-bind="$attrs" v-model="modelValue" :placeholder="$t('请输入邮箱地址')" class="w-full" />
    <InputIcon class="position-y-center !mt-0">
      <RoleSplit v-model="roleModelValue"></RoleSplit>
    </InputIcon>
  </IconField>
</template>

<style lang="scss" scoped></style>
