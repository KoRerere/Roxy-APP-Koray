<script setup lang="tsx">
import { $t } from '/@/locales'
import { isEmptyValue, safeParseJSON, sleep } from '/@/utils'
import { useResponseToast } from '/@/hooks/useResponseToast';
import { useDialog } from '/@/hooks/useDialog'
import WechatPayModal from '/@/views/pay/wallet/components/payway-wechat-modal.vue';
import DiskInsufficient from '/@/views/browser/list/profiles/components/disk-Insufficient.vue';
import WelcomeModal from '/@/views/tutorial/components/welcome-modal.vue';
import GuideModal from '/@/views/tutorial/components/guide-modal.vue';
import VideoModal from '/@/views/tutorial/components/video-modal.vue';
import CustomNewEmpty from '/@/components/custom-new-empty.vue'

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
      container: ({ hideModal }) => <GuideModal
        title={$t('欢迎加入')}
        desc={({ class: className }) => {
          return <>
            <div class={className}>Incididunt et elit pariatur mollit Lorem consectetur sunt aliqua et in mollit consectetur Lorem et ullamco. Nulla minim elit qui. Laborum ex do fugiat irure eiusmod laborum
              velit anim ut. Quis enim id est. Nulla consequat incididunt labore enim enim. </div>
            <div class={className}>Incididunt et elit pariatur mollit Lorem consectetur sunt aliqua et in mollit consectetur Lorem et ullamco. Nulla minim elit qui. </div>
          </>
        }}
        video="/video/copy_workspace_id.mp4"
        onClose={hideModal}
      ></GuideModal>
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
    },
    slots: {
      container: ({ hideModal }) => <VideoModal video="https://roxybrowser.com" external="https://roxybrowser.com" onClose={hideModal} />,
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
import FormItem from '/@/views/lab/components/form/item.vue'

const formRef = useTemplateRef<any>('wcisman')
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
    separator: true,
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
function noFormIdWcis() {
  formRef.value?.instance.submit()
}
function setInputsProps() {
  formRef.value?.setInputsProps({
    firstname: {
      preIcon: 'base/rx_ic_portrait-spark-light',
    },
    mselect: {
      options: [
        { label: 'test1', value: 'test1' },
        { label: 'test2', value: 'test2' },
        { label: 'test3', value: 'test3' },
        { label: 'test4', value: 'test4' },
        { label: 'test5', value: 'test5' },
        { label: 'test6', value: 'test6' },
        { label: 'test7', value: 'test7' },
      ],
    }
  })
}

//=========================================
import AsyncSwitch from './components/async-switch.vue';
const checked1 = ref(false);
const checked2 = ref(true);

</script>

<template>
  <div class="relative inline-flex flex-col items-start gap-4 w-full h-full">
    <!-- <div @click="checked = !checked">111</div> -->
    <AsyncSwitch v-model="checked1"></AsyncSwitch>
    <AsyncSwitch v-model="checked2"></AsyncSwitch>
    <!-- <RxButton label="open1" @click="open1"></RxButton> -->
    <!-- <RxButton label="open2" @click="open2"></RxButton> -->
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
    <!-- <div class="mx-auto sm:w-80 flex flex-col justify-center items-center gap-2 w-full h-full">
      <TsForm ref="wcisman" position="left" id="wcis" :inputs="inputs" @submit="onFormWcis">
        <template #default="{ inputs }">
          <Accordion :value="['0']" multiple>
            <AccordionPanel value="0">
              <AccordionHeader>what can i say man!</AccordionHeader>
              <AccordionContent>
                <div class="flex flex-col gap-3">
                  <FormItem v-for="input in inputs" :key="input.name" :input="input" />
                </div>
              </AccordionContent>
            </AccordionPanel>
          </Accordion>
        </template>
      </TsForm>
      <RxButton class="w-full" type="submit" label="normal submit" form="wcis" />
      <RxButton class="w-full" outlined severity="secondary" label="no form id submit" @click="noFormIdWcis"></RxButton>
      <RxButton class="w-full" outlined severity="secondary" label="set inputs props" @click="setInputsProps"></RxButton>
    </div> -->
  </div>
</template>

<style lang="scss" scoped></style>
