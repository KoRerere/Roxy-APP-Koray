<script setup>
import ryForm from '/@/components/ry-form'
import inputBase from '/@/components/ry-form/input-base.vue'
import drawerContent from '/@/components/drawer-content.vue'

import { formatInputs } from '/@/utils'

const formInputs = ref([
  {
    type: 'textarea',
    label: 'Smart detection',
    name: 'SOCKS7',
    value: null,
    placeholder: 'Paste proxy rules like:\nhost:port:user:password:refreshingURL',
    tooltip: 'man!',
  },
  {
    separator: true,
  },
  {
    label: 'Server',
    value: null,
    items: [
      {
        type: 'select',
        name: 'type',
        placeholder: 'select type',
        options: [
          { label: 'aaa', value: 'A' },
          { label: 'bbb', value: 'M' },
        ],
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
    placeholder: 'Username for your server',
  },
  {
    type: 'password',
    name: 'SOCKS5',
    label: 'Password',
    value: null,
    placeholder: 'Password for your server',
  },
  {
    type: 'text',
    label: 'Refreshing URL',
    name: 'SOCKS6',
    value: null,
    placeholder: 'Please enter a valid URL',
    tooltip: 'mamba out!',
    icon: 'mdi mdi-refresh',
  },
])

function _getFormData () {
  console.log('🚀 ~ getFormData ~ formatInputs(formInputs.value):', formatInputs(formInputs.value))
}
</script>

<template>
  <drawer-content title="创建代理" v-bind="$attrs">
    <div class="h-full flex flex-col">
      <Button @click="_getFormData">
        getFormData
      </Button>
      <ry-form :inputs="formInputs">
        <template #server="{ input }">
          <input-base v-bind="input">
            <template #input>
              <InputGroup>
                <template v-for="(item, index) in input.items" :key="index">
                  <Select v-if="item.type === 'select'" v-bind="item" v-model="item.value" option-label="label"
                    option-value="value" show-clear />
                  <InputText v-else v-bind="item" v-model="item.value" type="text" />
                </template>
              </InputGroup>
            </template>
          </input-base>
        </template>
        <template #protocol="{ input }">
          <input-base v-bind="input">
            <template #input>
              <div class="form-protocol">
                <label v-for="option in input.options" :key="option.key" :for="option.value"
                  class="cursor-pointer form-protocol-item">
                  <RadioButton v-model="input.value" :input-id="option.value" :name="input.name"
                    :value="option.value" />
                  <div>{{ option.label }}</div>
                </label>
              </div>
            </template>
          </input-base>
        </template>
      </ry-form>
    </div>
    <template #footer>
      <ry-button label="Test Proxy" severity="secondary" outlined />
      <ry-button label="Save selected" severity="info" />
    </template>
  </drawer-content>
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
