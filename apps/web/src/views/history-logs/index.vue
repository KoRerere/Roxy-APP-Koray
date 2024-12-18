<script setup lang="tsx">
import type { UnwrapRowType, UserGetOperateLogListData } from '@roxy/backend-api'
import { format } from 'date-fns'
import { API } from '/@/api'
import { RxSvgIcon, type SvgNames } from '/@/components/rx-icon/'
import { $t } from '/@/locales'

type Data = UnwrapRowType<UserGetOperateLogListData>

const styles = useCssModule()

const columns = ref([
  {
    title: $t('成员'),
    key: 'userName',
    render: ({ data }: { data: Data }) => (
      <div>
        <div class={styles['user-email']}>{data.email}</div>
        <div class={styles['user-name']}>{data.userName}</div>
      </div>
    ),
  },
  {
    title: $t('操作'),
    key: 'operateType',
  },
  {
    title: $t('具体内容'),
    key: 'operateDetail',
    width: 240,
  },
  {
    title: $t('时间'),
    key: 'operateTime',
  },
  {
    title: $t('结果'),
    key: 'status',
    getText: (data: Data) => data.status ? $t('成功') : $t('失败'),
  },
  {
    title: $t('操作者 IP'),
    key: 'location',
    slot: 'location',
  },
])

function tableRequest(params: any) {
  return API.logging.userGetOperateLogList(params)
}

async function tableFilters() {
  const { data } = await API.team.userGetMemberInfoByWorkspaceList({})
  return [
    {
      type: 'multiple',
      name: 'userNameIds',
      value: [],
      placeholder: $t('全部成员'),
      options: data.rows.map(user => ({ label: user.email, value: user.user_id })),
    },
    {
      type: 'multiple',
      name: 'operateModule',
      value: [],
      placeholder: $t('全部操作'),
      options: [
        { label: $t('窗口'), value: 'Profiles' },
        { label: $t('代理'), value: 'Proxies' },
        { label: $t('账号'), value: 'Accounts' },
        { label: $t('项目'), value: 'Projects' },
        { label: $t('扩展'), value: 'Extensions' },
        // { label: $t('成员'), value: 'Members' },
        { label: $t('团队'), value: 'Teams' },
      ],
    },
    {
      type: 'date',
      name: 'date',
      placeholder: $t('全部时间'),
      formatValue: (input: any, _: any, formData: any) => {
        const [startDate, endDate] = (input.value || []).map((date: Date) => format(date, 'yyyy-MM-dd'))
        Object.assign(formData, { startDate, endDate })
      },
    },
  ]
}
</script>

<template>
  <div class="flex flex-col w-full h-full logs">
    <ViewsHeader class="flex-col !gap-1" :title="($route.meta.title as string)">
      <div class="description">
        {{ $t('仅保留过去7天的操作日志，超出7天的日志将被自动清除。') }}
      </div>
    </ViewsHeader>
    <div class="flex flex-1 overflow-hidden">
      <RyTable cacheKey="history-log-list" :table-filters="tableFilters" :columns="columns" :table-request="tableRequest" :show-actions="false" :show-display="false" :context-menu="false">
        <template #table-empty>
          <CustomEmpty icon="rx_illustration_filter.svg" :title="$t('暂无匹配结果')" :desc="$t('在当前条件下没有匹配结果。请使用其他过滤器再试一次。')" />
        </template>

        <template #location="{ data }">
          <div class="flex items-center gap-1 locationip ">
            <RxSvgIcon :name="(`country-code/${data.code}` as SvgNames)" fallback="base/rx_ic_earth" />
            <div>{{ data.countryCode }}</div>
            <RxSvgIcon v-tooltip.top="{ value: data.location.replace(';', '\n') }" :tooltip-options="{ placement: 'bottom', showDelay: 500 }" name="base/rx_ic_info" color="#C7CDD1" :size="14" />
          </div>
        </template>
      </RyTable>
    </div>
  </div>
</template>

<style lang="scss" module>
.user-email {
  color: #000;
  font-family: Inter;
  font-size: 12px;
  font-weight: 600;
  line-height: 16px;
}

.user-name {
  color: var(--Colors-Text-text-tertiary, #7c8387);
  font-family: Inter;
  font-size: 12px;
  line-height: var(--Line-Height-text-xs, 16px);
}
</style>

<style lang="scss" scoped>
.description {
  color: var(--Colors-Text-text-tertiary, #7c8387);
  font-family: Inter;
  font-size: 12px;
  font-style: normal;
  font-weight: 400;
  line-height: 16px;
}

.locationip {
  color: var(--Colors-Text-text-primary, #171c1f);
  font-family: Inter;
  font-size: 12px;
  line-height: 16px;
}
</style>
