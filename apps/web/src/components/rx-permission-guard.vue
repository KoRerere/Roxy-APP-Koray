<script setup lang="ts">
import { usePermission } from '/@/hooks/usePermission'
import type { Permission, PermissionMode } from '/@/hooks/usePermission/type'

const props = withDefaults(
  defineProps<{
    permission?: Permission
    permissions?: Permission[]
    mode?: PermissionMode
  }>(),
  { mode: 'any' },
)

const { check } = usePermission()

const hasPermission = computed(() => check(props.permission ?? props.permissions, props.mode))
</script>

<template>
  <slot v-if="hasPermission" />
  <slot v-else name="fallback" />
</template>
