<script setup lang="ts">
const props = defineProps({
  name: String,
  type: {
    type: String,
    default: 'text',
  },
  tooltip: String,
  icon: String,
  iconClick: {
    type: Function,
    default: () => () => { },
  },
})

function onIconClick(attrs: Record<string, unknown>) {
  console.log('🚀 ~ onIconClick ~ toRaw(attrs):', toRaw(attrs))
  // toRaw(props)
  // console.log('🚀 ~ props:', props)
}

const xxx = useAttrs()
if (xxx.mark) {
  console.log('🚀 ~ xxx:', xxx)
}
</script>

<template>
  <div class="ry-input">
    <slot>
      <slot name="label">
        <label v-if="$attrs.label" class="ry-input-label" :for="name">
          <span>{{ $attrs.label }}</span>
          <span v-if="tooltip" v-tooltip.top="tooltip" class="mdi mdi-alert-octagon ry-input-label-tooltip" />
        </label>
      </slot>
      <slot name="input" :input="$attrs">
        <Textarea v-if="type === 'textarea'" :id="name" v-bind="$attrs" />
        <Password v-if="type === 'password'" :id="name" :feedback="false" toggle-mask v-bind="$attrs" />
        <IconField>
          <InputText v-if="type === 'text'" :id="name" class="w-full" v-bind="$attrs" />
          <InputNumber v-if="type === 'number'" :id="name" class="w-full" v-bind="$attrs" />
          <InputIcon>
            <span v-if="icon" :class="icon" @click="onIconClick($attrs)" />
          </InputIcon>
        </IconField>
      </slot>
    </slot>
  </div>
</template>

<style lang="scss" scoped>
:deep(.p-password-input) {
  width: 100%;
}

.ry-input {
  display: flex;
  flex-direction: column;
  align-self: stretch;

  &-label {
    display: flex;
    height: 20px;
    align-items: center;
    gap: var(--spacing-sm, 4px);
    align-self: stretch;
    margin-bottom: var(--spacing-sm, 4px);
    color: var(--Component-Colors-TextInput-label-label, #171c1f);
    font-family: Inter;
    font-size: 12px;
    font-style: normal;
    font-weight: 500;
    line-height: var(--Line-Height-text-lg, 20px);

    &-tooltip {
      font-size: 12px;
    }
  }
}
</style>
