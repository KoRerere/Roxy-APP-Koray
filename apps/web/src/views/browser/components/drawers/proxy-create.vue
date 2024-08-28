<script setup>
import ryForm from '/@/components/ry-form'
import drawerContent from '/@/components/drawer-content.vue'
import { getFormData } from '/@/utils'
import { useToast } from 'primevue/usetoast'

const emits = defineEmits(['confirm'])

const toast = useToast()
const formInputs = ref([])

function getInputs () {
  const $dict_map = JSON.parse(localStorage.getItem('$dict_map') ?? '{}')

  formInputs.value = [
    {
      type: 'textarea',
      label: '智能检测',
      value: null,
      placeholder: 'Paste proxy rules like:\nhost:port:user:password:refreshingURL',
      rows: 3,
      tooltip: 'man!',
    },
    {
      separator: true,
    },
    {
      type: 'radio',
      label: '网络协议',
      name: 'ipType',
      value: $dict_map.ipType[0].value,
      options: $dict_map.ipType,
      tooltip: 'what can i say',
    },
    {
      label: 'Server',
      items: [
        {
          type: 'select',
          name: 'protocol',
          placeholder: '请选择网络协议',
          value: $dict_map.protocol[0].value,
          options: $dict_map.protocol,
        },
        {
          type: 'text',
          name: 'host',
          value: null,
          placeholder: '代理主机',
        },
        {
          type: 'text',
          name: 'port',
          value: null,
          placeholder: '代理端口',
        },
      ],
      tooltip: 'what can i say',
      slot: 'server',
    },
    {
      type: 'text',
      label: '代理账号',
      name: 'proxyUserName',
      value: null,
      placeholder: 'Username for your server',
    },
    {
      type: 'password',
      label: '代理密码',
      name: 'proxyPassword',
      value: null,
      placeholder: 'Password for your server',
    },
    {
      type: 'text',
      label: '刷新URL',
      name: 'refreshUrl',
      value: null,
      placeholder: 'Please enter a valid URL',
      tooltip: 'mamba out!',
      icon: 'mdi mdi-refresh',
      iconClick () {
        toast.add({ severity: 'warn', summary: 'scvr', detail: 'Message Content', life: 3000 })
      },
    },
  ]
}

function testProxy () {

}

function createProxy () {
  try {
    const formData = getFormData(formInputs.value)
    emits('confirm', formData)
  }
  catch (error) {
    console.log(error)
  }
}

onMounted(() => {
  getInputs()
})
</script>

<template>
  <drawer-content title="创建代理" v-bind="$attrs">
    <div class="h-full flex flex-col">
      <ry-form :inputs="formInputs">
        <template #server="{ input }">
          <InputGroup>
            <template v-for="(item, index) in input.items" :key="index">
              <Select v-if="item.type === 'select'" v-bind="item" v-model="item.value" option-label="label"
                option-value="value" show-clear />
              <InputText v-else v-bind="item" v-model="item.value" type="text" />
            </template>
          </InputGroup>
        </template>
      </ry-form>
    </div>
    <template #footer>
      <div class="flex justify-between w-full">
        <ry-button label="Test Proxy" severity="secondary" outlined @click="testProxy" />
        <ry-button label="Save selected" severity="info" @click="createProxy" />
      </div>
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
