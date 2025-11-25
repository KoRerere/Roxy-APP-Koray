<script setup lang="tsx">
import { $t } from '/@/locales'
import { enhanceCountdown, isEmptyValue, safeParseJSON, sleep } from '/@/utils'
import { useResponseToast } from '/@/hooks/useResponseToast';
import { useDialog } from '/@/hooks/useDialog'
import WechatPayModal from '/@/views/pay/wallet/components/payway-wechat-modal.vue';
import DiskInsufficient from '/@/views/browser/list/profiles/components/disk-Insufficient.vue';
import WelcomeModal from '/@/views/tutorial/components/welcome-modal.vue';
import VideoModal from '/@/views/tutorial/components/video-modal.vue';
import CustomNewEmpty from '/@/components/custom-new-empty.vue'
import HomeBackModal from '/@/views/browser/shared/home-back-modal.vue';
import BlackFridayModal from '/@/views/campaign/black-friday-modal.vue';

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
      container: ({ hideModal }) => <HomeBackModal onClose={hideModal}></HomeBackModal>
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
      // mask: "!backdrop-blur-md",
    },
    slots: {
      container: ({ hideModal }) => <BlackFridayModal onClose={hideModal}></BlackFridayModal>
    },
  })
}
//============ table ===================
import wcisTable from './components/table/table.vue'
import { useUserStore } from '/@/stores/user'

import { differenceInDays, format, subDays } from 'date-fns'
import { LogRetentionDays, SubLevelEnum } from '/@/enums/pay'
const { userPayInfo } = storeToRefs(useUserStore())

async function tableFilters() {
  const { data } = await API.team.userGetMemberInfoByWorkspaceList({})

  const days = LogRetentionDays[userPayInfo.value?.subLevel as SubLevelEnum]
  return [
    {
      type: 'mselect',
      name: 'userNameIds',
      props: {
        placeholder: $t('全部成员'),
        options: data.rows.map(user => ({ label: user.email, value: user.user_id })),
      }
    },
    {
      type: 'mselect',
      name: 'operateModule',
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
        selectionMode: 'range',
        maxDate: new Date(),
        minDate: subDays(new Date(), 60),// 只会保留 60 天内的数据
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

const columns = [
  { header: "Tomato 🍅", field: 'code' },
  { header: "Lettuce 🥬", field: 'name' },
  { header: "Cheese 🧀", field: 'category' },
  { header: "Carrot 🥕", field: 'quantity' }
]

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
  code: index,
  name: `mamba_${index}`,
  faq: 'man!',
  category: `category_${index}`,
  quantity: 'actions',
}))

const selectedProducts = ref()

//============ form ========================
import TsForm from './components/form/index.vue';
import Test from '/@/views/lab/components/test.vue';
import FormItem from '/@/views/lab/components/form/item.vue'
import { API } from '/@/api';

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
const countdown = ref()

function testCountdown() {
  const endTimestamp = 24 * 60 * 60 * 1000 + Date.now() + 3000
  countdown.value = enhanceCountdown(endTimestamp, (data) => {
    console.log(data)
  }, { lessThan24Interval: 1 / 60 })
}

function stopTestCountdown() {
  countdown.value?.stop()
}

</script>

<template>
  <div class="relative inline-flex flex-col items-start pa-4 gap-4 w-full h-full overflow-hidden">
    <!-- <wcisTable displayKey="wcisman" :table-filters="tableFilters" :columns="columns" :model="originalModel" :data-list="datalist" selection-mode="multiple">
    </wcisTable> -->

    <!-- RoxyBrowser 团队提供了对流媒体特别优化的代理服务，您可以前往代理中心进行<a href="#/resource/agent?name=shop&action=buy">购买与使用</a>。

    RoxyBrowser Team provides proxy services specially optimized for streaming media. You can go to the Proxy Center to <a href="#/resource/agent?name=shop&action=buy">purchase and use</a>.

    Команда RoxyBrowser предоставляет прокси для стриминга. Перейдите в Центр прокси для <a href="#/resource/agent?name=shop&action=buy">покупки и использования</a>. -->

    <RxButton label="open1" @click="open1"></RxButton>
    <RxButton label="open2" @click="open2"></RxButton>

    <RxButton severity="secondary" label="start" @click="testCountdown"></RxButton>
    <RxButton severity="secondary" label="stop" @click="stopTestCountdown"></RxButton>
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

<style lang="scss" scoped>
.platform {
  color: var(--colors-text-text-secondary);
  font-size: 12px;
  line-height: 20px;
}

.cmd {
  border: 1px solid var(--primitives-netural-900);
  background: var(--pattern-editor-bg);
  color: var(--pattern-editor-code);
  font-family: "JetBrains Mono";
  font-size: 12px;
  font-weight: 500;
}
</style>
