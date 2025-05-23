<script setup lang="tsx">
import type { UnwrapRowType, UserGetInviteUserListListData, UserGetPromotionInfoListData } from '@roxy/backend-api'
import { format } from 'date-fns'
import { API } from '/@/api'
import { RxSvgIcon, type SvgNames } from '/@/components/rx-icon/'
import { $t } from '/@/locales'

type Data = UnwrapRowType<UserGetInviteUserListListData>

const { promotionInfo } = defineProps<{
  promotionInfo: UserGetPromotionInfoListData['data']
}>()

const columns = ref([
  {
    title: $t('用户'),
    key: 'userName',
    render: ({ data }: { data: Data }) => (
      <div>
        {data.email?.slice(0, 2)}****{data.email?.split('@')[1]}
      </div>
    ),
  },
  {
    title: $t('来源链接'),
    key: 'source',
  },
  {
    title: $t('返利比例'),
    key: 'youGet',
    render: ({ data }: { data: Data }) => (
      <div class="text-[#FC9D12]">
        {data.youGet}%
      </div>
    ),
  },
  {
    title: $t('用户优惠'),
    key: 'theyGet',
    render: ({ data }: { data: Data }) => (
      <div class="text-[#FC9D12]">
        {data.theyGet}%
      </div>
    ),
  },
  {
    title: $t('注册时间'),
    key: 'status',
    getText: (data: Data) => format(data.createTime * 1000, 'yyyy-MM-dd HH:mm:ss'),
  },
])

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
          const [start_time, end_time] = (input.value || []).map((date: Date) => date / 1000)
          Object.assign(formData, { start_time, end_time: end_time ? end_time : start_time + 86399 })
        }
        console.log('input.value ', input.value)
      },
    },
    {
      type: 'select',
      name: 'source',
      size: "small",
      placeholder: $t('请选择来源链接'),
      showClear: true,
      options: promotionInfo.promotionLinkList?.map(item => ({ label: item.linkType, value: item.linkType })),
    },
  ]
}
</script>

<template>
  <RyTable cacheKey="history-log-list" :table-filters="tableFilters" :columns="columns" :table-request="tableRequest" :show-actions="false" :show-display="false" :context-menu="false">
    <template #table-empty>
      <CustomEmpty icon="rx_illustration_filter.svg" :title="$t('暂无名下用户')" />
    </template>

    <template #location="{ data }">
      <div class="flex items-center gap-1 locationip ">
        <RxSvgIcon :name="(`country-code/${data.code}` as SvgNames)" fallback="base/rx_ic_earth" />
        <div>{{ data.countryCode }}</div>
        <RxSvgIcon v-tooltip.top="{ value: data.location.replace(';', '\n') }" :tooltip-options="{ placement: 'bottom', showDelay: 500 }" name="base/rx_ic_info" color="#C7CDD1" :size="14" />
      </div>
    </template>
  </RyTable>
</template>

<style lang="scss" module>
.user-email {
  color: var(--colors-text-text-primary, #FAFAFA);
  font-family: Inter;
  font-size: 12px;
  font-weight: 600;
  line-height: 16px;
}

.user-name {
  color: var(--colors-text-text-tertiary, #575D60);
  font-family: Inter;
  font-size: 12px;
  line-height: var(--Line-Height-text-xs, 16px);
}
</style>

<style lang="scss" scoped>
.description {
  color: var(--colors-text-text-tertiary, #575D60);
  font-family: Inter;
  font-size: 12px;
  font-style: normal;
  font-weight: 400;
  line-height: 16px;
}

.locationip {
  color: var(--colors-text-text-primary, #fafafa);
  font-family: Inter;
  font-size: 12px;
  line-height: 16px;
}
</style>
