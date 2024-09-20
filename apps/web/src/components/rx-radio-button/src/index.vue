<script setup lang=ts>
defineProps({
  options: {
    type: Array as PropType<{ label: string, value: string }[]>,
    default: () => [],
  },
})

const id = useId()

const modelValue = ref('')
</script>

<template>
  <div class="card flex justify-center">
    <div class="flex flex-wrap gap-4">
      <template v-for="item in options" :key="item.value">
        <div class="flex items-center">
          <RadioButton v-model="modelValue" :input-id="`${item.value}-${id}`" :value="item.value" />
          <label :for="`${item.value}-${id}`" class="ml-2">{{ item.label }}</label>
        </div>
      </template>
    </div>
  </div>
</template>
