<script setup lang="tsx">
import { h } from 'vue'
import currency from 'currency.js'
import { genDriver, sleep } from '/@/utils'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { useDialog } from '/@/hooks/useDialog'
import RxButton from '/@/components/rx-button'
import TrialEnded from '/@/layout/components/header/components/trial-ended.vue'
// import TsFormInputText from '/@/views/lab/components/form/m-input-text.vue'
// import { emitter } from '/@/utils/eventBus'
import SellOutModal from '/@/views/agent/shop/components/sell-out-modal.vue'
import ActivityRechangeModal from '/@/views/campaign/freedom/activity-rechange-modal.vue'
import RaffleModal from './raffle-modal.vue'
// import BillingCenterRoleModal from './warn-tips-modal.vue'
// import ActivityPlanModal from '/@/views/campaign/freedom/activity-plan-modal.vue'
import DoubeOpen from './doube-open.vue'
// ============ table ===================
// import wcisTable from './components/table/table.vue'
// import { useUserStore } from '/@/stores/user'
// import { differenceInDays, format, subDays } from 'date-fns'
// import type { SubLevelEnum } from '/@/enums/pay'
// import { LogRetentionDays } from '/@/enums/pay'
// ============ form ========================
// import TsForm from './components/form/index.vue'
import Test from '/@/views/lab/components/test.vue'

import NextBouns from '/@/views/campaign/june-eighteen/next-bouns.vue'

// ====================================

// import FormItem from '/@/views/lab/components/form/item.vue'
// import { API } from '/@/api'
// import { getInviteCode } from '/@/api/util'
const router = useRouter()
const [showModal] = useDialog()
const [showToast] = useResponseToast()

function _open1() {
  showModal({
    showHeader: false,
    modal: true,
    blockScroll: true,
    // closeOnEscape: false,
    // pt: {
    //   root: '!border-none !shadow-none rounded-lg overflow-hidden',
    //   // mask: "!backdrop-blur-md",
    // },
    slots: {
      container: ({ hideModal }) => <RaffleModal onClose={hideModal}></RaffleModal>,
    },
  })
}

function getToastMessage(options: { msg: string, reCheck?: () => void }) {
  return (
    <div class="flex flex-col gap-2">
      <div>{options.msg}</div>
      <div class="flex gap-2 justify-end">
        <RxButton text name="base/rx_ic_close" size="xxs" label={$t('重新检测')} onClick={options.reCheck}></RxButton>
        <RxButton
          text
          name="base/rx_ic_reload"
          size="xxs"
          label={$t('检查代理配置')}
          onClick={() => { router.push({ name: 'agent-list' }) }}
        >
        </RxButton>
      </div>
    </div>
  )
}

function _open2() {
  showToast(-1, getToastMessage({ msg: '代理 IP 检测失败，可能由于代理失效或本地网络波动导致。', reCheck: () => { console.log('reCheck') } }))

  // showModal({
  //   showHeader: false,
  //   modal: true,
  //   blockScroll: true,
  //   // pt: {
  //   //   // root: "!bg-transparent !border-none !shadow-none",
  //   //   mask: '!backdrop-blur-md',
  //   // },
  //   slots: {
  //     container: ({ hideModal }) => <LastPayModal onClose={hideModal} onSuccess={hideModal}></LastPayModal>,
  //   },
  // })
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
    command: () => {
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
    command: () => {
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
    command: async () => {
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
const _inputs = [
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
function _onFormWcis(values: Record<string, any>) {
  console.log(values)
}
function _noFormIdWcis() {
  formRef.value?.instance.submit()
}
function _setInputsProps() {
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

// ====================================

/** 聚光灯 Teleport 到 body，需高于 driver 遮罩（通常 z-index:10000） */
const mambaRef = useTemplateRef<HTMLElement>('mamba')
const mambaSpotlightOn = ref(false)
const mambaSpotlightRect = reactive({
  top: 0,
  left: 0,
  width: 0,
  height: 0,
  borderRadius: '0px',
})

function syncMambaSpotlightRect() {
  const el = mambaRef.value
  if (!el)
    return
  const r = el.getBoundingClientRect()
  mambaSpotlightRect.top = r.top
  mambaSpotlightRect.left = r.left
  mambaSpotlightRect.width = r.width
  mambaSpotlightRect.height = r.height
  mambaSpotlightRect.borderRadius = getComputedStyle(el).borderRadius || '0px'
}

const _mambaSpotlightStyle = computed(() => ({
  top: `${mambaSpotlightRect.top}px`,
  left: `${mambaSpotlightRect.left}px`,
  width: `${mambaSpotlightRect.width}px`,
  height: `${mambaSpotlightRect.height}px`,
  borderRadius: mambaSpotlightRect.borderRadius,
}))

let stopMambaSpotlightSync: (() => void) | undefined

watch(mambaSpotlightOn, (on) => {
  stopMambaSpotlightSync?.()
  stopMambaSpotlightSync = undefined
  if (!on)
    return

  const handler = () => syncMambaSpotlightRect()
  handler()
  window.addEventListener('scroll', handler, true)
  window.addEventListener('resize', handler)
  const ro = new ResizeObserver(handler)
  if (mambaRef.value)
    ro.observe(mambaRef.value)

  stopMambaSpotlightSync = () => {
    window.removeEventListener('scroll', handler, true)
    window.removeEventListener('resize', handler)
    ro.disconnect()
  }
})

onScopeDispose(() => {
  stopMambaSpotlightSync?.()
})

function _driverStart() {
  genDriver({
    showProgress: false,
    disableActiveInteraction: false,
    allowClose: true,
    overlayClickBehavior: 'close',
    showButtons: ['close'],
    stagePadding: 0,
    popoverOffset: 20,
    onDestroyed: () => {
      mambaSpotlightOn.value = false
    },
    steps: [
      {
        element: '#mamba',
        popover: {
          description: 'oooooooooooooout!',
          side: 'right',
          align: 'center',
        },
        onHighlightStarted: () => {
          nextTick(() => {
            requestAnimationFrame(() => {
              mambaSpotlightOn.value = true
            })
          })
        },
        onDeselected: () => {
          mambaSpotlightOn.value = false
        },
      },
      {
        element: '#group',
        popover: {
          description: '关注 1 和 3 这两个选项\n关注 1 和 3 这两个选项',
          side: 'top',
          align: 'center',
        },
        onHighlightStarted: () => {
          highlightTargets([1, 2, 3]) // 1 和 3
        },
        onDeselected: () => {
          clearHighlight()
        },
      },
    ],
  }).drive()
}

function highlightTargets(indexes: number[]) {
  const items = document.querySelectorAll('.box')

  items.forEach((el, i) => {
    if (indexes.includes(i)) {
      el.classList.add('fake-highlight')
    }
  })
}

function clearHighlight() {
  document.querySelectorAll('.fake-highlight')
    .forEach(el => el.classList.remove('fake-highlight'))
}

const ipItems = [
  { placeholder: '0~255', min: 0, max: 255 },
  { separator: true, text: '.' },
  { placeholder: '0~255', min: 0, max: 255 },
  { separator: true, text: '.' },
  { placeholder: '0~255', min: 0, max: 255 },
  { separator: true, text: '.' },
  { placeholder: '0~255', min: 0, max: 255 },
  { separator: true },
  { placeholder: '0~65535', min: 1, max: 65535 },
]

const ipValues = ref([192, 168, 134, 22])
</script>

<template>
  <div class="relative inline-flex flex-col items-start pa-4 gap-4 w-full h-full overflow-visible">
    <NextBouns :amount="10" />
    <div>
      <RxInputGroup v-model="ipValues" :items="ipItems" class="max-w-xs" />
    </div>
    <!-- <a href="/workspace/teams">wcis man</a> -->

    <!-- <wcisTable display-key="wcisman" :table-filters="_tableFilters" :columns="_columns" :model="_originalModel" :data-list="_datalist" selection-mode="multiple" /> -->

    <!-- <RxButton label="open1" @click="_open1" />
    <RxButton label="open2" @click="_open2" />
    <DoubeOpen /> -->
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
      <TsForm ref="wcisman" position="left" id="wcis" :inputs="inputs" @submit="_onFormWcis">
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
<RxButton class="w-full" outlined severity="secondary" label="no form id submit" @click="_noFormIdWcis"></RxButton>
<RxButton class="w-full" outlined severity="secondary" label="set inputs props" @click="_setInputsProps"></RxButton>
</div> -->
  </div>
</template>

<style lang="scss" scoped>
/* 聚光灯已 Teleport 到 body（.mamba-spotlight-ring--body），#mamba 保留 .mamba-ripple-wrap 供 driver 选择器 */

.mamba-spotlight-ring--body {
  position: fixed;
  z-index: 10001;
  box-sizing: border-box;
  pointer-events: none;
  /* 与 Roxyweb3 guide-spotlight-ring / spotlight-ring-pulse 同源 */
  box-shadow:
    0 0 0 4px rgba(102, 126, 234, 0.8),
    0 0 0 8px rgba(102, 126, 234, 0.4),
    0 0 30px 15px rgba(102, 126, 234, 0.6);
  animation: mamba-spotlight-ring-pulse 2s ease-in-out infinite;
  will-change: box-shadow;
}

@keyframes mamba-spotlight-ring-pulse {
  0%,
  100% {
    box-shadow:
      0 0 0 4px rgba(102, 126, 234, 0.8),
      0 0 0 8px rgba(102, 126, 234, 0.4),
      0 0 30px 15px rgba(102, 126, 234, 0.6);
  }

  50% {
    box-shadow:
      0 0 0 6px rgba(102, 126, 234, 1),
      0 0 0 12px rgba(102, 126, 234, 0.6),
      0 0 50px 25px rgba(102, 126, 234, 0.8);
  }
}
</style>

<style lang="scss" scoped>
.fake-highlight {
  position: relative;
  z-index: 10001;
}

/* 外层光圈 */
.fake-highlight::after {
  content: '';
  position: absolute;
  inset: -6px;
  /* 控制光圈离元素的距离 */
  border-radius: 14px;
  pointer-events: none;

  box-shadow: 0 0 0 0 rgba(255, 200, 0, 0.9);
  animation: pulse-ring 1.6s ease-out infinite;
}

@keyframes pulse-ring {
  0% {
    box-shadow: 0 0 0 0 rgba(255, 200, 0, 0.9);
    opacity: 1;
  }

  70% {
    box-shadow: 0 0 0 14px rgba(255, 200, 0, 0);
    opacity: 0.6;
  }

  100% {
    box-shadow: 0 0 0 0 rgba(255, 200, 0, 0);
    opacity: 0;
  }
}
</style>
