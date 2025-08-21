<script setup lang="ts">
import { useFormContext } from '/@/views/lab/components/form/useContext'

const { name } = defineProps<{
  name: string
}>()

const { setValues } = useFormContext()

function onUpdate1(value: string) {
  setValues({ [name]: value, firstname: 'x' })
}

function onUpdate2(value: string) {
  setValues({ [name]: value, firstname: value })
}
</script>

<template>
  <div class="flex gap-2">
    <RxButton label="value1" @click="onUpdate1('wc1')" />
    <RxButton label="ddd value2" @click="onUpdate2('wcis man!')" />
  </div>
</template>

<style scoped></style>
