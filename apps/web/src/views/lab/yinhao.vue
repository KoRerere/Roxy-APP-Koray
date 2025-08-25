<script setup lang="tsx">
import { $t } from '/@/locales'
import { sleep } from '/@/utils'
import { useResponseToast } from '/@/hooks/useResponseToast';
import { useDialog } from '/@/hooks/useDialog'
import WechatPayModal from '/@/views/pay/wallet/components/payway-wechat-modal.vue';

const [showModal] = useDialog()
const [showToast] = useResponseToast()

function open1() {
  showModal({
    showHeader: false,
    modal: true,
    blockScroll: true,
    pt: {
      root: "!border-none !shadow-none rounded-lg",
      // mask: "!backdrop-blur-md",
    },
    slots: {
      container: () => <div></div>
    },
  })
}

function open2() {
  const data = {
    endTime: "2025-08-11 16:04:06",
    orderAmount: 6,
    orderNo: "175489584640630090",
    payId: "rybda4b969-014e-4952-811b-a07034222b8d",
    payType: "USDT",
    payUrl: "TMvCmCtz2Chayje3igsFbWkzo8prNQo7fa",
    realAmount: 6.03
  }

  showModal({
    showHeader: false,
    modal: true,
    blockScroll: true,
    slots: {
      container: ({ hideModal }) => <WechatPayModal data={data} onClose={hideModal} />,
    },
  })
}

//============ table ===================
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
  faq: 'man!',
  category: `category_${index}`,
  quantity: 'actions',
}))
//============ form ========================
import TsForm from './components/form/index.vue';
import Test from '/@/views/lab/components/test.vue';
import type { PayWay } from '/@/enums/pay';

const inputs = [
  {
    type: 'text',
    name: 'firstname',
    label: 'First Name',
    tooltip: 'wcis man!',
    props: {
      placeholder: '请选择',
      preIcon: 'base/rx_ic_2fa',
      icon: 'base/rx_ic_2fa',
      size: 'md',
    },
    resolver: (z: any) => z.string({
      invalid_type_error: $t('请输入空间名称'),
    })
      .min(1, $t('请输入空间名称'))
      .regex(/^[^\u4E00-\u9FA5]+$/, $t('空间名称不能包含中文'))
      .max(20, $t('空间名称最多 20 个字符')),
  },
  {
    type: 'mselect',
    name: 'mselect',
    label: 'Multi Select',
    props: {
      showToggleAll: false,
      filter: false,
      placeholder: '请选择',
      options: [
      ]
    }
  },
  {
    name: 'mamba',
    label: 'mamba',
    value: 'x',
    render: (props: any) => <Test {...props}></Test>,
    resolver: (z: any) => z.string({
      invalid_type_error: 'must 5 string man!'
    }).min(5, 'must 5 string man!'),
  }
]

const onFormWcis = (values: Record<string, any>) => {
  console.log(values)
}

const formRef = useTemplateRef<any>('wcisman')

function noFormIdWcis() {
  formRef.value?.instance.submit()
}
//=========================================

const isDuplicate = ref(false)

</script>

<template>
  <div class="relative inline-flex flex-col items-start gap-4 w-full h-full">
    <RxButton label="open1" @click="open1"></RxButton>
    <RxButton label="open2" @click="open2"></RxButton>


    <RxCheckbox v-model="isDuplicate" input-id="wrap" binary />
    <!-- <RxButton label="exportText" @click="exportText"></RxButton> -->
    <!-- <RxButton label="exportCSV" @click="exportCSV"></RxButton> -->
    <!-- <DataTable :value="datalist.slice(0, 3)">
      <Column selection-mode="multiple">
        <template #headercheckboxicon="slotProps">
          {{ slotProps }}
        </template>
<template #rowcheckboxicon="{ checked }">
          <SvgIcon v-if="checked" name="base/rx_ic_delete" color="#ffffff" />
        </template>
</Column>
<Column v-for="col of columns" :key="col.field" :field="col.field" :header="col.header"></Column>
</DataTable> -->

    <!-- <wcisTable displayKey="wcisman" :table-filters="tableFilters" v-model:columns="columns" :model="originalModel" :data-list="datalist" selection-mode="multiple"></wcisTable> -->
    <!-- <div class="flex flex-col gap-2 pa-20 scale-150">
      <RxInputRadio v-model="checked2" :options="[{ label: '1', value: 1 }, { label: '2', value: 2 }]" />
    </div> -->
    <div class="mx-auto sm:w-80 flex flex-col justify-center items-center gap-2 w-full h-full">
      <TsForm ref="wcisman" position="left" id="wcis" :inputs="inputs" @submit="onFormWcis"></TsForm>
      <RxButton class="w-full" type="submit" outlined severity="secondary" label="Submit" form="wcis" />
      <RxButton class="w-full" label="test submit" @click="noFormIdWcis"></RxButton>
    </div>
  </div>
</template>

<style lang="scss" scoped></style>
