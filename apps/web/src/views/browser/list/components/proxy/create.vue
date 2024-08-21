<script setup>
import ryForm from '/@/components/ry-form'
import inputBase from '/@/components/ry-form/input-base.vue'

import { formatInputs } from '/@/utils'

const formInputs = ref([
  {
    type: 'textarea',
    label: 'Smart detection',
    name: 'SOCKS7',
    value: null,
    placeholder: 'this is placeholder',
    tooltip: 'man!',
  },
  {
    separator: true,
  },
  {
    label: 'Server',
    value: null,
    children: [
      {
        type: 'text',
        name: 'type',
        placeholder: 'select type',
        // options: [
        //   { label: 'aaa', value: 'A' },
        //   { label: 'bbb', value: 'M' },
        // ],
      },
      {
        type: 'text',
        name: 'host',
        placeholder: 'Host',
      },
      {
        type: 'text',
        name: 'port',
        placeholder: ':Prot',
      },
    ],
    tooltip: 'what can i say',
    slot: 'server',
  },
  {
    label: 'Protocol',
    name: 'protocol',
    value: null,
    options: [
      { label: 'IPv4', value: 'A' },
      { label: 'IPv6', value: 'M' },
    ],
    tooltip: 'what can i say',
    slot: 'protocol',
  },
  {
    type: 'text',
    label: 'Username',
    name: 'SOCKS4',
    value: null,
  },
  {
    type: 'password',
    name: 'SOCKS5',
    label: 'Password',
    value: null,
  },
  {
    type: 'text',
    label: 'label标题',
    name: 'SOCKS6',
    value: null,
    tooltip: 'mamba out!',
    icon: 'mdi mdi-refresh',
  },
])

function getFormData () {
  console.log('🚀 ~ getFormData ~ formatInputs(formInputs.value):', formatInputs(formInputs.value))
}
</script>

<template>
  <div>
    <ry-form :inputs="formInputs">
      <template #server="{ input }">
        <input-base v-bind="input">
          <template #input>
            <InputGroup>
              {{ input.children }}
              <div v-for="item in input.children" :key="item.name">
                <input-base v-bind="item" />
              </div>
            </InputGroup>
          </template>
        </input-base>
      </template>
      <template #protocol="{ input }">
        <input-base v-bind="input">
          <template #input>
            <div class="form-protocol">
              <div v-for="option in input.options" :key="option.key" class="form-protocol-item">
                <RadioButton v-model="input.value" :input-id="option.value" :name="input.name" :value="option.value" />
                <label :for="option.value" class="cursor-pointer">{{ option.label }}</label>
              </div>
            </div>
          </template>
        </input-base>
      </template>
    </ry-form>
  </div>
</template>

<style lang="scss" scoped>
.form-protocol {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-lg, 8px);

  &-item {
    display: flex;
    min-width: 120px;
    padding: 10px 10px 10px var(--spacing-xl, 12px);
    align-items: center;
    gap: var(--spacing-lg, 8px);
    border-radius: var(--Component-Colors-TextInput-radius-radius-lg, 8px);
    border: 1px solid var(--Component-Colors-TextInput-border-border, #c7cdd1);
    background: var(--Component-Colors-TextInput-bg-bg, #ffffff);
    box-shadow: 0px 1px 2px 0px rgba(16, 24, 40, 0.05);
  }
}
</style>
