<script setup lang="tsx">
import { sleep } from '/@/utils'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { useDialog } from '/@/hooks/useDialog'
import RxButton from '/@/components/rx-button'
import WelcomeModal from '/@/views/tutorial/components/welcome-modal'
import TsFormInputText from '/@/views/lab/components/form/m-input-text.vue'
import BatchInviteModal from '/@/views/projects/components/batch-invite-modal.vue'
import Demo from './demo.vue'
// import { emitter } from '/@/utils/eventBus'

// ============ table ===================
// import wcisTable from './components/table/table.vue'
// import { useUserStore } from '/@/stores/user'
// import { differenceInDays, format, subDays } from 'date-fns'
// import type { SubLevelEnum } from '/@/enums/pay'
// import { LogRetentionDays } from '/@/enums/pay'
// ============ form ========================
// import TsForm from './components/form/index.vue'
import Test from '/@/views/lab/components/test.vue'
// import FormItem from '/@/views/lab/components/form/item.vue'
// import { API } from '/@/api'
// import { getInviteCode } from '/@/api/util'

const [showModal] = useDialog()
const [showToast] = useResponseToast()

function open1() {
  showModal({
    showHeader: false,
    modal: true,
    blockScroll: true,
    pt: {
      root: '!border-none !shadow-none rounded-lg overflow-hidden',
      // mask: "!backdrop-blur-md",
    },
    slots: {
      container: ({ hideModal }) => <WelcomeModal onClose={hideModal}></WelcomeModal>,
    },
  })
}

function open2() {
  showModal({
    showHeader: false,
    modal: true,
    blockScroll: true,
    pt: {
      // root: "!bg-transparent !border-none !shadow-none",
      // mask: "!backdrop-blur-md",
    },
    slots: {
      container: () => <BatchInviteModal></BatchInviteModal>,
    },
  })
}
// const { userPayInfo } = storeToRefs(useUserStore())

async function _tableFilters() {
  // const days = LogRetentionDays[userPayInfo.value?.subLevel as SubLevelEnum]
  return [
    {
      type: 'mselect',
      name: 'operateModule',
      props: {
        placeholder: $t('全部操作'),
        options: [
          { label: $t('窗口'), value: 'Profiles' },
          { label: $t('代理 IP'), value: 'Proxies' },
          { label: $t('账号'), value: 'Accounts' },
          { label: $t('项目'), value: 'Projects' },
          { label: $t('扩展'), value: 'Extensions' },
          { label: $t('团队'), value: 'Teams' },
        ],
      },
    },
    {
      type: 'date',
      name: 'date',
      props: {
        placeholder: $t('全部时间'),
        selectionMode: 'range',
        maxDate: new Date(),
        // minDate: subDays(new Date(), 60), // 只会保留 60 天内的数据
      },
      // formatValue: (input: any, _: any, formData: any) => {
      //   // 如果用户是免费用户，则只能查询过去3天的数据， 3 天之前需要提示
      //   if (input.value?.[0] && days < 60) {
      //     if (differenceInDays(new Date(), new Date(input.value[0])) > days) {
      //       // showToast({
      //       //   severity: 'warn',
      //       //   summary: $t('您只能查看{days}天内的日志', { days }),
      //       //   detail: !isOwner.value
      //       //     ? $t('如需查看更多日志，请联系空间的拥有者进行升级。')
      //       //     : userPayInfo.value.autoRenewDowngrade
      //       //       ? ''// 特殊情况，如果用户是自动续费降级用户，则不显示升级提醒
      //       //       : <I18nT keypath={$t('如需查看更多历史日志，请{link}', { link: '{link}' })} >
      //       //         {{ link: () => <a class="cursor-pointer align-middle" onClick={upgradePlan}>{$t('单击此处升级')}</a> }}
      //       //       </I18nT>,
      //       //   life: 5000
      //       // })
      //       return
      //     }
      //   }
      //   const [startDate, endDate = startDate] = (input.value || []).map((date: Date) => date ? format(date, 'yyyy-MM-dd') : undefined)
      //   Object.assign(formData, { startDate, endDate })
      // },
    },
  ]
}

const _columns = [
  { header: 'Tomato 🍅', field: 'code', headerRender: h('div', '123') },
  { header: 'Lettuce 🥬', field: 'name' },
  { header: 'Cheese 🧀', field: 'category' },
  { header: 'Carrot 🥕', field: 'quantity' },
]

const _originalModel = [
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
      },
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
      showToast(0, `${data.category}: normal1`)
    },
  },
  {
    label: 'normal2',
    icon: 'base/rx_ic_download',
    disabled: true,
  },
]

const _datalist = Array.from({ length: 50 }, (_, index) => ({
  id: `${index}`,
  code: index,
  name: `mamba_${index}`,
  faq: 'man!',
  category: `category_${index}`,
  quantity: 'actions',
}))

// const selectedProducts = ref()

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
      ],
    },
  },
  {
    name: 'mamba',
    label: 'mamba',
    value: 'x',
    render: (props: any) => <Test {...props}></Test>,
    resolver: (z: any) => z.string({
      invalid_type_error: 'must 5 string man!',
    }).min(5, 'must 5 string man!'),
  },
]
function onFormWcis(values: Record<string, any>) {
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
    },
  })
}

// =========================================

function captcha() {
  const code = ref()

  showModal({
    showHeader: false,
    modal: true,
    blockScroll: true,
    slots: {
      container: ({ hideModal }) => {
        return (
          <div class="w-100">
            <img class="block w-full" src="https://primefaces.org/cdn/primevue/images/galleria/galleria11.jpg" />
            <TsFormInputText v-model={code.value}></TsFormInputText>
            <RxButton
              label="submit"
              onClick={
                async () => {
                  console.log(code.value)
                  hideModal()
                }
              }
            >
            </RxButton>
          </div>
        )
      },
    },
  })
}

// getInviteCode().then(code => console.log('🚀 ~ getInviteCode().then ~ code:', code))

const selectedCity = ref()
const cities = ref([
  { name: 'New York', code: 'NY' },
  { name: 'Rome', code: 'RM' },
  { name: 'London', code: 'LDN' },
  { name: 'Istanbul', code: 'IST' },
  { name: 'Paris', code: 'PRS' },
])
</script>

<template>
  <div class="relative inline-flex flex-col items-start pa-4 gap-4 w-full h-full overflow-hidden">
    <!-- <wcisTable displayKey="wcisman" :table-filters="_tableFilters" :columns="_columns" :model="_originalModel" :data-list="_datalist" selection-mode="multiple">
    </wcisTable> -->

    <RxButton label="open1" @click="open1" />
    <RxButton label="open2" @click="open2" />
    <RxButton label="captcha" @click="captcha" />

    <Select v-model="selectedCity" editable :options="cities" filter option-label="name" placeholder="Select a City" class="w-full md:w-56" />

    <Demo />

    <!-- <ScrollPanel class="w-100 h-100">
      <p>
        Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris
        nisi ut aliquip ex ea commodo consequat.
        Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit
        anim id est laborum.
      </p>
      <p>
        Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae
        vitae dicta sunt explicabo. Nemo enim ipsam
        voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt. Consectetur, adipisci velit, sed quia non numquam
        eius modi.
      </p>
      <p>
        At vero eos et accusamus et iusto odio dignissimos ducimus qui blanditiis praesentium voluptatum deleniti atque corrupti quos dolores et quas molestias excepturi sint occaecati cupiditate non
        provident, similique sunt in culpa qui
        officia deserunt mollitia animi, id est laborum et dolorum fuga. Et harum quidem rerum facilis est et expedita distinctio. Nam libero tempore, cum soluta nobis est eligendi optio cumque nihil
        impedit quo minus.
      </p>
      <p class="m-0">
        Quod maxime placeat facere possimus, omnis voluptas assumenda est, omnis dolor repellendus. Temporibus autem quibusdam et aut officiis debitis aut rerum necessitatibus saepe eveniet ut et
        voluptates repudiandae sint et molestiae non
        recusandae. Itaque earum rerum hic tenetur a sapiente delectus, ut aut reiciendis voluptatibus maiores alias consequatur aut perferendis doloribus asperiores repellat
      </p>
    </ScrollPanel> -->

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

<style scoped></style>
