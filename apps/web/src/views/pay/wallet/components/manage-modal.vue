<script setup lang="tsx">
import RxButton from '/@/components/rx-button/'
import { RxSvgIcon } from '/@/components/rx-icon/'
import { I18nT } from "vue-i18n"
import currency from 'currency.js';
import { format } from 'date-fns';
import { $t } from '/@/locales'
import { API } from '/@/api'
import { useUserStore } from '/@/stores/user';
import { useResponseToast } from '/@/hooks/useResponseToast'
import { PaymentStatus, PaymentStatusStr } from '/@/enums/pay'
import { useDialog as RxUseDialog } from '/@/hooks/useDialog'
import { getAdvancedFeature } from '/@/constants/advanced-feature';
import LoadingImage from '/@/assets/images/status/loading.png';

const [showToast, onlyErrorToast] = useResponseToast()
const { userPayInfo } = storeToRefs(useUserStore())
const { getUserPayInfo } = useUserStore()
const [showModal] = RxUseDialog()
const cancelCss = useCssModule('popup')
const repayCss = useCssModule('repay')

const emit = defineEmits(['close'])

const rtableRef = useTemplateRef('rtable')
const features = getAdvancedFeature()
const featureTexts = [
  features.slice(0, 5),
  features.slice(5)
]

const columns = [
  {
    title: $t('扣款日期'),
    key: 'createTime',
    getText: (row: any) => format(row.createTime, 'yyyy/MM/dd'),
    style: {
      width: '35%'
    }
  },
  {
    title: $t('金额'),
    key: 'actualAmount',
    getText: (row: any) => currency(row.actualAmount).format(),
    style: {
      width: '25%'
    }
  },
  {
    title: $t('状态'),
    key: 'payStatus',
    slot: 'status',
    style: {
      width: '40%'
    }
  }
]

function tableRequest() {
  return API.pay.userGetPurchaseRecordsInfoList({
    isAuto: '1',//固定传 1 查询订阅扣款类型
    mainOrderNo: userPayInfo.value.orderNo,
    page_index: 1,
    page_size: 1000
  })
}

async function cancelSubscribe() {
  const dialogInstance = showModal({
    showHeader: false,
    modal: true,
    blockScroll: true,
    pt: {
      content: '!pa-0'
    },
    slots: {
      container: ({ handleCancel }) => {
        return <div class="flex flex-col pt-4 pb-6 px-6 gap-4 w-160">
          <div class={`relative flex items-center h-9 ${cancelCss.header}`}>
            <span>{$t('取消订阅服务')}</span>
            <span class="absolute right-0 cursor-pointer" onClick={handleCancel}>
              <RxSvgIcon size="20" name="base/rx_ic_delete"></RxSvgIcon>
            </span>
          </div>
          <div class={`flex flex-col gap-3 whitespace-pre-wrap ${cancelCss.content}`}>
            <div>{$t('是否确认取消当前订阅服务？当前订阅到期后将无法继续使用以下高级功能：')}</div>
            <div class="flex gap-2.5 font-400 color-[#F53838]">
              {
                featureTexts.map(list =>
                  <div class="flex flex-col min-w-50 gap-2.5">
                    {
                      list.map(item => {
                        return <div class="flex items-center gap-3">
                          <RxSvgIcon name="base/rx_ic_delete"></RxSvgIcon>
                          <span>{item}</span>
                        </div>
                      })
                    }
                  </div>
                )
              }
            </div>
            <div>{$t('订阅取消后，您的 Roxy 会员权益将会持续至 {date}', { date: format(userPayInfo.value.subEndDate, 'yyyy/MM/dd') })}</div>
          </div>
          <div class="flex gap-3">
            <RxButton class="flex-1" outlined severity="secondary" size='lg' label={$t('取消')} onClick={handleCancel}></RxButton>
            <RxButton class="flex-1" severity="danger" size='lg' label={$t('确认并取消订阅')} onClick={_onCancel}></RxButton>
          </div>
        </div>
      }
    },
  })

  async function _onCancel() {
    const { code, msg } = await API.pay.userCancelSubscriptionList({ orderNo: userPayInfo.value.orderNo })
    onlyErrorToast(code, msg)
    if (code !== 0) return
    await getUserPayInfo()
    showToast(code, msg)
    dialogInstance.handleCancel()
    onClose()
  }
}

async function onRepay(row: any) {
  window.open(row.failAddress)

  const dialogInstance = showModal({
    showHeader: false,
    modal: true,
    blockScroll: true,
    pt: {
      content: '!pa-0'
    },
    slots: {
      container: ({ handleCancel }) => {
        return <div class="flex flex-col pt-12 pb-6 px-6 gap-6 w-110">
          <img class="block mx-auto w-8 h-8 loading-circle" src={LoadingImage} />
          <div class={`${repayCss.header}`}>{$t('支付处理中...')}</div>
          <div class={`flex flex-col gap-3 whitespace-pre-wrap ${repayCss.content}`}>{$t('请在打开的页面中完成订单支付，支付成功后请点击以下按钮 (订单处理最多存在 5 分钟延迟)')}</div>
          <div class={`flex flex-col gap-2.5 ${repayCss.help}`}>
            <RxButton class="flex-1" size='lg' label={$t('完成支付')} onClick={confirm}></RxButton>
            <RxButton class="flex-1" outlined severity="secondary" size='lg' label={$t('取消')} onClick={handleCancel}></RxButton>
            <I18nT tag="div" keypath={$t('* 支付遇到问题？ {link}', { link: '{link}' })} scope="global">
              {{ link: () => <span class={`cursor-pointer ${repayCss.link}`} onClick={openLiveChat}>{$t('联系我们')}</span> }}
            </I18nT>
          </div>
        </div>
      }
    },
  })

  function confirm() {
    dialogInstance.handleCancel()
    rtableRef.value?.refresh()
  }
}

function openLiveChat() {
  LiveChatWidget.call('maximize')
}

function onClose() {
  emit('close')
}
</script>

<template>
  <div class="flex flex-col pt-4 pb-6 px-6 gap-6 w-185">
    <div class="relative flex items-center h-9 header">
      <span>{{ $t('管理订阅') }}</span>
      <SvgIcon class="absolute right-0 cursor-pointer" color="#575D61" size="20" name="base/rx_ic_delete"
        @click="onClose">
      </SvgIcon>
    </div>
    <div>
      <div class="flex items-center justify-between">
        <i18n-t class="amount" tag="div" :keypath="$t('{amount}/每月', { amount: '{amount}' })" scope="global">
          <template #amount>
            <span class="amount-value">{{ currency(userPayInfo.realAmount).format() }}</span>
          </template>
        </i18n-t>
        <RxButton size="lg" outlined severity="secondary" :label="$t('取消订阅')" @click="cancelSubscribe"></RxButton>
      </div>
      <div class="mt-4 desc">{{ $t('您的订阅将于 {date} 续订。', { date: format(userPayInfo.subEndDate, 'yyyy/MM/dd') }) }}</div>
      <!-- <div class="mt-4 desc">
        <div>{{ $t('您的订阅将于 {date} 续订, 套餐详情:', { date: format(userPayInfo.subEndDate, 'yyyy/MM/dd') }) }}</div>
        <div>{{ $t('窗口数量: {count}', { count: 0 }) }}</div>
        <div>{{ $t('计费金额: {amount}/每月', { amount: currency(userPayInfo.realAmount).format() }) }}</div>
      </div> -->
    </div>
    <div>
      <div class="py-4 record">{{ $t('账单记录') }}</div>
      <div class="flex h-80">
        <RyTable ref="rtable" :columns="columns" :table-request="tableRequest" :show-actions="false"
          :show-table-header="false" :context-menu="false" :paginator="false">
          <template #status="{ data }">
            <div class="flex items-center gap-2.5 status"
              :class="{ 'red': [PaymentStatus.Wait, PaymentStatus.Fail].includes(data.payStatus) }">
              <div>{{ PaymentStatusStr[data.payStatus as keyof typeof PaymentStatusStr] }}</div>
              <RxButton v-if="[PaymentStatus.Wait, PaymentStatus.Fail].includes(data.payStatus)" outlined
                severity="secondary" :label="$t('立即支付')" icon="base/rx_ic_credit_card" size="xxs"
                @click="onRepay(data)"></RxButton>
            </div>
          </template>
        </RyTable>
      </div>
    </div>
  </div>
</template>

<style lang="scss" module="popup">
.header {
  color: var(--Colors-Text-text-primary, #171C1F);
  font-size: 16px;
  font-weight: 700;
  line-height: 24px;
}

.content {
  color: var(--Colors-Text-text-primary, #171C1F);
  font-size: 14px;
  font-weight: 400;
  line-height: 20px;
}
</style>

<style lang="scss" module="repay">
.header {
  color: #000;
  text-align: center;
  font-size: 16px;
  font-style: normal;
  font-weight: 700;
  line-height: 20px;
}

.content {
  color: var(--Colors-Text-text-tertiary, #7C8387);
  font-size: 14px;
  line-height: 25.6px;
}

.help {
  color: var(--Colors-Text-text-tertiary, #7C8387);
  font-family: Inter;
  font-size: 12px;
  line-height: normal;
}

.link {
  color: var(--Color-blue-300, #12A3FC);
  text-decoration-line: underline;
  text-decoration-style: solid;
  text-decoration-skip-ink: auto;
  text-decoration-thickness: auto;
  text-underline-offset: auto;
  text-underline-position: from-font;
}
</style>

<style lang="scss" scoped>
.header {
  color: #000;
  font-family: Inter;
  font-size: 20px;
  font-weight: 600;
  line-height: normal;
}

.amount {
  color: var(--Colors-Text-text-primary, #171C1F);
  font-family: Inter;
  font-size: 24px;
  font-weight: 600;
  line-height: normal;

  &-value {
    font-size: 36px;

  }
}

.desc {
  color: var(--Colors-Text-text-tertiary, #7C8387);
  font-size: 16px;
  line-height: normal;
}

.record {
  border-top: 1px solid var(--Colors-Border-border-inactive, #E4E8EB);

  color: var(--Colors-Text-text-primary, #171C1F);
  font-family: Inter;
  font-size: 16px;
  font-weight: 700;
  line-height: 20px;
}

.status {
  color: var(--Color-green-400, #2E994C);
  font-family: Inter;
  font-size: 12px;
  line-height: normal;

  &.red {
    color: var(--Color-red-300, #F53838);
  }
}
</style>
