<script setup lang="ts">
import { useFormContext } from '/@/views/lab/components/form/useContext'

defineOptions({ inheritAttrs: false })

const { field, input } = defineProps<{ field: any, input: any }>()

const { setFieldValue, setValues } = useFormContext()

function onUpdate(value: any) {
  setFieldValue(input.name, value)
}

function onUpdates(value: Record<string, any>) {
  setValues(value)
}

</script>

<template>
  <input :value="field.value" type="hidden">
  <component :is="input.render" :name="input.name" v-bind="{ ...input.props, ...$attrs }" @update="onUpdate" @updates="onUpdates" />
</template>

<style scoped></style>
