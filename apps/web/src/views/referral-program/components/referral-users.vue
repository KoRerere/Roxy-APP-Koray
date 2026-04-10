<script setup lang="ts">
import { format } from 'date-fns'

import { API } from '/@/api'
import type { SvgNames } from '/@/components/rx-icon'
import type { UnwrapRowType, UserGetInviteUserListV2ListData, UserGetPromotionInfoListData } from '@roxy/backend-api'

type Data = UnwrapRowType<UserGetInviteUserListV2ListData>

const { promotionInfo } = defineProps<{
  promotionInfo: UserGetPromotionInfoListData['data']
}>()

const columns = [
  {
    title: $t('用户'),
    key: 'userName',
    getText: (data: Data) => data.email || data.phone,
  },
  {
    title: $t('来源链接'),
    key: 'source',
  },
  {
    title: $t('非代理返利比例'),
    key: 'youGet',
    classes: 'text-orange-400',
    getText: (data: Data) => `${data.youGet}%`,
  },
  {
    title: $t('代理返利比例'),
    key: 'proxyYouGet',
    classes: 'text-orange-400',
    getText: (data: Data) => `${data.proxyYouGet}%`,
  },
  {
    title: $t('用户优惠'),
    key: 'theyGet',
    classes: 'text-orange-400',
    getText: (data: Data) => `${data.theyGet}%`,
  },
  {
    title: $t('注册时间'),
    key: 'status',
    getText: (data: Data) => format(new Date(data.createTime!).getTime() * 1000, 'yyyy-MM-dd HH:mm:ss'),
  },
]

function tableRequest(params: any) {
  return API.base.userGetInviteUserListV2List(params)
}

async function tableFilters() {
  return [
    {
      type: 'date',
      name: 'date',
      placeholder: $t('请选择时间'),
      formatValue: (input: any, _: any, formData: any) => {
        if (Array.isArray(input.value) && input.value[0]) {
          const [start_time, end_time] = (input.value || []).map((date: Date) => date.getTime() / 1000)
          Object.assign(formData, { start_time, end_time: end_time || start_time + 86399 })
        }
      },
    },
    {
      type: 'select',
      name: 'source',
      placeholder: $t('请选择来源链接'),
      showClear: true,
      options: promotionInfo.promotionLinkList?.map(item => ({ label: item.linkType, value: item.linkType })),
    },
  ]
}
</script>

<template>
  <RyTable cache-key="history-log-list" :table-filters="tableFilters" :columns="columns" :table-request="tableRequest" :show-actions="false" :show-display="false" :context-menu="false">
    <template #table-empty>
      <CustomEmpty icon="rx_illustration_filter.svg" :title="$t('暂无名下用户')" />
    </template>

    <template #location="{ data }">
      <div class="flex items-center gap-1 locationip ">
        <SvgIcon :name="(`country-code/${data.code}` as SvgNames)" fallback="base/rx_ic_earth" />
        <div>{{ data.countryCode }}</div>
        <SvgIcon v-tooltip.top="{ value: data.location.replace(';', '\n') }" :tooltip-options="{ placement: 'bottom', showDelay: 500 }" name="base/rx_ic_info" color="#C7CDD1" :size="14" />
      </div>
    </template>
  </RyTable>
</template>

<style lang="scss" scoped>
.description {
  color: var(--colors-text-text-tertiary);
  font-size: 12px;
  line-height: 16px;
}

.locationip {
  color: var(--colors-text-text-primary);
  font-size: 12px;
  line-height: 16px;
}
</style>
