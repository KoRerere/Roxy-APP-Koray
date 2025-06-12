<script setup lang="tsx">
import { $t } from '/@/locales'
import { sleep } from '/@/utils'
import { useResponseToast } from '/@/hooks/useResponseToast';
import PlanModal from '../pay/wallet/components/plan-success.vue'
import BalanceModal from '../pay/wallet/components/balance-success.vue'
import { useDialog } from '/@/hooks/useDialog'

const [showModal] = useDialog()
const [showToast] = useResponseToast()

function open1() {
  showModal({
    showHeader: false,
    modal: true,
    blockScroll: true,
    pt: {
      root: "!bg-transparent !border-none !shadow-none",
      content: "!pa-20",
      mask: "!backdrop-blur-md",
    },
    slots: {
      container: () => <PlanModal />,
    },
  })
}

function open2() {
  showModal({
    showHeader: false,
    modal: true,
    blockScroll: true,
    pt: {
      root: "!bg-transparent !border-none !shadow-none",
      content: "!pa-20",
      mask: "!backdrop-blur-md",
    },
    slots: {
      container: () => <BalanceModal />,
    },
  })
}

//===============================
import wcisTable from './components/table/table.vue'

async function tableFilters() {
  return [
    {
      type: 'select',
      name: 'wcis',
      value: [],
      props: {
        placeholder: $t('操作'),
        options: [
          { label: $t('窗口'), value: 'Profiles' },
          { label: $t('代理'), value: 'Proxies' },
          { label: $t('账号'), value: 'Accounts' },
          { label: $t('项目'), value: 'Projects' },
          { label: $t('扩展'), value: 'Extensions' },
          { label: $t('团队'), value: 'Teams' },
        ],
      }
    },
    {
      type: 'multiple',
      name: 'operateModule',
      value: [],
      props: {
        placeholder: $t('全部操作'),
        options: [
          { label: $t('窗口'), value: 'Profiles' },
          { label: $t('代理'), value: 'Proxies' },
          { label: $t('账号'), value: 'Accounts' },
          { label: $t('项目'), value: 'Projects' },
          { label: $t('扩展'), value: 'Extensions' },
          { label: $t('团队'), value: 'Teams' },
        ],
      }
    },
    {
      type: 'date',
      name: 'date',
      props: {
        placeholder: $t('全部时间'),
        maxDate: new Date(),
      }
    },
  ]
}

const columns = ref([
  { header: "Tomato 🍅", field: 'code' },
  { header: "Lettuce 🥬", field: 'name' },
  { header: "Cheese 🧀", field: 'category' },
  { header: "Carrot 🥕", field: 'quantity' }
])

const originalModel = [
  {
    label: 'only quick',
    icon: 'base/rx_ic_at',
    command: (event: any) => {
      return false
    },
    quick: true,
    onlyQuick: true,
    multiple: {
      name: 'G1',
      props: {
        label: 'Restart',
      }
    },
  },
  {
    label: 'only multiple',
    icon: 'base/rx_ic_shut_down',
    command: (event: any) => {
    },
    quick: true,
    onlyMultiple: true,
    multiple: {
      name: 'G2',
    },
  },
  {
    label: 'quick, multiple, normal, async command',
    icon: 'base/rx_ic_2fa',
    command: async (event: any) => {
      await sleep(2000)
    },
    quick: true,
    multiple: {
      name: 'G2',
    },
  },
  {
    separator: true,
  },
  {
    label: 'normal1',
    icon: 'base/rx_ic_download',
    command: (event: any) => {
      const data: any = [].concat(event.data)[0]
      showToast(0, data.category + ': normal1')
    }
  },
  {
    label: 'normal2',
    icon: 'base/rx_ic_download',
    disabled: true,
  },
]

const datalist = Array.from({ length: 50 }, (_, index) => ({
  id: `${index}`,
  code: index * 2,
  name: `mamba_${index}`,
  category: `category_${index}`,
  quantity: 'actions',
}))
//====================================
import TsForm from './components/form/index.vue';
import Test from './components/test.vue'
import type { AutoCompleteCompleteEvent } from 'primevue/autocomplete';

const inputs = [
  // {
  //   type: 'text',
  //   name: 'username',
  //   label: 'Username',
  //   props: {
  //     preIcon: 'base/rx_ic_2fa',
  //     icon: 'base/rx_ic_2fa',
  //     size: 'md',
  //   },
  //   resolver: (z: any) => z.string({
  //     invalid_type_error: $t('请输入空间名称'),
  //   })
  //     .min(1, $t('请输入空间名称'))
  //     .regex(/^[^\u4E00-\u9FA5]+$/, $t('空间名称不能包含中文'))
  //     .max(20, $t('空间名称最多 20 个字符')),
  // },
  // {
  //   type: 'number',
  //   name: 'aaaaa',
  //   label: 'Age',
  //   value: 1102,
  // },
  // {
  //   type: 'mselect',
  //   name: 'scvr1',
  //   label: 'Scvr1',
  //   value: [1, 2, 3, 4],
  //   props: {
  //     maxSelectedLabels: 3,
  //     options: [
  //       { label: '1111111', value: 1 },
  //       { label: '2222222', value: 2 },
  //       { label: '3333333', value: 3 },
  //       { label: '4444444', value: 4 },
  //       { label: '5555555', value: 5 },
  //     ],
  //   },
  // },
  // {
  //   type: 'select',
  //   name: 'eddp',
  //   value: { label: '1', value: 1 },
  //   props: {
  //     options: [
  //       { label: '1', value: 1 },
  //       { label: '2', value: 2 },
  //       { label: '3', value: 3 },
  //     ],
  //   },
  // },
  // {
  //   type: 'textarea',
  //   name: 'lastname',
  //   label: 'Last Name',
  //   resolver: (z: any) => z.string({
  //     invalid_type_error: 'wcis man!',
  //   })
  //     .min(2, 'wcis man!')
  // },
  // {
  //   type: 'text',
  //   name: 'mamba',
  //   label: 'mamba',
  //   value: 'what can is say men!',
  //   render: (props: any) => <Test {...props}></Test>,
  //   resolver: (z: any) => z.string({
  //     invalid_type_error: 'must 5 string man!'
  //   })
  //     .min(5, 'must 5 string man!'),
  // }
  {
    type: 'date',
    name: 'date',
    props: {
      placeholder: $t('全部时间'),
    }
  }
]

const onFormSubmit = (values: Record<string, any>) => {
  console.log(values)
}

const formRef = useTemplateRef<any>('wcisman')

function noFormIdSubmit() {
  formRef.value?.instance.submit()
}
//==================================

const filters = reactive({
  value: 0,
  options: [
    {
      name: $t('全部'),
      value: 0,
    },
    {
      name: $t('团队'),
      value: 1,
    },
    {
      name: $t('个人'),
      value: 2,
    },
  ],
  onChange() {
  },
  resetFilters() {
  },
})

</script>

<template>
  <div class="relative inline-flex flex-col items-start gap-4 w-full h-full">
    <!-- <div class="flex flex-col gap-2">
      <RxAlert announcement title="wcis man!" type="success"></RxAlert>
      <RxAlert title="wcis man!" type="info"></RxAlert>
      <RxAlert title="wcis man!" type="warn"></RxAlert>
      <RxAlert title="wcis man!" type="error"></RxAlert>
    </div> -->
    <!-- <wcisTable displayKey="wcisman" :table-filters="tableFilters" v-model:columns="columns" :model="originalModel" :data-list="datalist" selection-mode="multiple"></wcisTable> -->
    <div class="flex flex-col justify-center items-center gap-2 w-full h-full">
      <TsForm class="sm:w-56" ref="wcisman" id="wcis" :inputs="inputs" @submit="onFormSubmit"></TsForm>
      <RxButton class="sm:w-56" type="submit" outlined severity="secondary" label="Submit" form="wcis" />
      <RxButton label="test submit" @click="noFormIdSubmit"></RxButton>
    </div>
  </div>
</template>

<style lang="scss" scoped></style>
