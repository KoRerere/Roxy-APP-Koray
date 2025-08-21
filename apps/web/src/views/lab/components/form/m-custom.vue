<script setup lang="ts">
import { useFormContext } from '/@/views/lab/components/form/useContext'

defineOptions({ inheritAttrs: false })

const { field, input } = defineProps<{ field: any, input: any }>()

const { setFieldValue } = useFormContext()

function onUpdate(value: any) {
  setFieldValue(input.name, value)
}

</script>

<template>
  <div>
    <input :value="field.value" type="hidden">
    <component :is="input.render" :name="input.name" v-bind="{ ...input.props, ...$attrs }" />
  </div>
</template>

<style scoped></style>
