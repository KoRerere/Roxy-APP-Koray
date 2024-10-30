<script lang="ts" setup>
import { RxAlert } from '/@/components/rx-alert'
import RxInputSelect from '/@/components/ry-form/rx-input-select.vue'
import { $t } from '/@/locales'

const inputs: any = ref(getInputs())

function getInputs(data: any = {}) {
  const $dict_map = new Proxy(JSON.parse(localStorage.getItem('$dict_map') ?? '{}'), {
    get(target, key) {
      return target[key] || [] // 简易兜底处理，后续优化获取字典逻辑
    },
  })

  const inputs = reactive([
    {
      label: $t('代理信息'),
      items: [
        {
          type: 'select',
          name: 'proxyCategory',
          value: $dict_map.protocol[1]?.value,
          options: $dict_map.protocol,
          filter: false,
          optionValue: 'value',
          formatValue: (input: any, _inputs: any, formData: any) => {
            Object.assign(formData, { protocol: input.value })
            return input.value
          },
        },
        {
          type: 'text',
          name: 'host',
          value: data.host ?? '2222',
          placeholder: $t('主机'),
          required: true,
        },
        { separator: true },
        {
          type: 'number',
          name: 'port',
          value: data.port ?? '333333',
          placeholder: $t('端口'),
          required: true,
        },
      ],
      tooltip: 'what can i say',
      slot: 'server',
    },
  ])
  return inputs
}
</script>

<template>
  <div class="flex gap-6 p-10 flex-col">
    <RyForm :inputs="inputs">
      <template #server="{ input }">
        <div class="flex">
          <div class="w-1/3">
            <RxInputSelect v-bind="input.items[0]" v-model="input.items[0].value" />
          </div>
          <inputNumberGroup class=" !shadow-none" :inputs="input.items" />
        </div>
      </template>
    </RyForm>
  </div>
</template>
