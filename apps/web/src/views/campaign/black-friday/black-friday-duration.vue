<script setup lang="tsx">
import { I18nT } from 'vue-i18n'
import { addDays, format } from 'date-fns'

import { API } from '/@/api'
import { useUserStore } from '/@/stores/user'
import { useCampaignStore } from '/@/stores/campaign'
import { useResponseToast } from '/@/hooks/useResponseToast'
import type { Duration } from '/@/views/pay/subscribe/type'

const emit = defineEmits<{
  (e: 'change', duration: Duration): void
}>()

const { userPayInfo } = storeToRefs(useUserStore())
const { blackFridayInfo } = storeToRefs(useCampaignStore())
const [_, onlyErrorToast] = useResponseToast()

const selectedDuration = defineModel<Duration>('modelValue')

const cssModule = useCssModule('css')
const durationList = ref<Duration[]>()
const loading = ref(false)

onBeforeMount(() => {
  getDiscountByDuration()
})

async function getDiscountByDuration() {
  loading.value = true
  const { code, data, msg } = await API.pay.userGetDurationDiscountsList()
  loading.value = false
  onlyErrorToast(code, msg)

  if (code !== 0)
    return

  durationList.value = Object.entries(data).map(([month, discount]) => ({
    key: `month${month}`,
    discount,
    title: $t('{day} 天', { day: Number(month) * 30 }),
    day: Number(month) * 30,
    month: Number(month),
    due: format(addDays(userPayInfo.value.subEndDate || Date.now(), Number(month) * 30), 'yyyy/MM/dd'),
    ...(Number(month) >= 12 && getCampaign(Number(month))),
  }))
  selectedDuration.value = durationList.value![1]
}

function getCampaign(month: number) {
  const day = Number(month) * 30
  const total = day * 2
  return {
    discountStr: $t('黑色星期五折扣'),
    due: format(addDays(userPayInfo.value.subEndDate || Date.now(), total), 'yyyy/MM/dd'),
    campaign: {
      title: $t('黑色星期五钜惠'),
      date: `${format(blackFridayInfo.value!.start_timestamp, 'yyyy/MM/dd')} - ${format(blackFridayInfo.value!.end_timestamp, 'yyyy/MM/dd')}`,
      desc: () => {
        return (
          <div class={`${cssModule.desc}`}>
            <I18nT scope="global" keypath={$t('您将获得 {bold1}\n并享受 {bold2}，折扣可叠加', { bold1: '{bold1}', bold2: '{bold2}' })}>
              {{
                bold1: () => <span class="text-white font-700">{$t('额外 {day} 天的订阅时长, 共 {total} 天', { day, total })}</span>,
                bold2: () => <span class="text-[#11a3fd] font-700">{$t('3 折优惠')}</span>,
              }}
            </I18nT>
          </div>
        )
      },
    },
  }
}

function onSelected(item: Duration) {
  selectedDuration.value = item
  emit('change', item)
}
</script>

<template>
  <div class="flex flex-col gap-1">
    <div v-for="item in durationList" :key="item.key" class="relative flex flex-col gap-3 py-5 px-4 rounded-2xl select-none cursor-pointer" :class="{ campaign: item.campaign }"
         @click="onSelected(item)"
    >
      <div v-if="item.campaign" class="absolute top-5 right-4 flex flex-col gap-2">
        <div :class="css.title">
          {{ item.campaign.title }}
        </div>
        <div :class="css.date">
          {{ item.campaign.date }}
        </div>
      </div>
      <div class="flex gap-3 items-center">
        <div class="radio" :class="{ active: selectedDuration?.key === item.key }" />
        <div class="days">
          {{ item.title }}
        </div>
        <div class="due">
          {{ $t('有效期至 {date}', { date: item.due }) }}
        </div>
      </div>
      <component :is="item.campaign.desc" v-if="item.campaign" class="pl-9 whitespace-pre-wrap" />
    </div>
  </div>
</template>

<style lang="scss" module="css">
.title {
  color: #fff;
  text-align: right;
  font-family: Archivo;
  font-size: 16px;
  font-weight: 700;
  line-height: normal;
}

.date {
  color: rgba(255, 255, 255, 0.6);
  text-align: right;
  font-size: 12px;
  font-weight: 500;
  line-height: normal;
}

.desc {
  color: rgba(255, 255, 255, 0.8);
  font-size: 16px;
  line-height: 1.5;
}
</style>

<style lang="scss" scoped>
.campaign {
  background-color: var(--campaign-BFCM-bg-card);
  background-image: url('/images/campaing/black-friday/card-bg.svg');
  background-size: cover;
  background-repeat: no-repeat;
  background-position: center;

  .days {
    color: #fff;
  }

  .due {
    color: #a9b0b4;
  }
}

.radio {
  position: relative;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border-width: 2px;
  border-style: solid;
  border-color: var(--colors-border-border-subtle);

  &.active {
    border-color: var(--colors-border-border-brand);

    &::before {
      content: '';
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background-color: var(--colors-border-border-brand);
    }
  }
}

.days {
  color: var(--colors-text-text-primary);
  font-size: 24px;
  font-weight: 600;
}

.due {
  color: var(--colors-text-text-tertiary);
  font-size: 16px;
}
</style>
