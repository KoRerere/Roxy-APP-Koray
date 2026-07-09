<script setup lang="tsx">
import { I18nT } from 'vue-i18n'
import { differenceInDays, format, subDays } from 'date-fns'
import { API } from '/@/api'
import { useUserStore } from '/@/stores/user'
import { LogRetentionDays, SubLevelEnum } from '/@/enums/pay'
import { showToast } from '/@/hooks/useResponseToast/handleBusinessCode'
import { usePermission } from '/@/hooks/usePermission'
import { useTeamStore } from '/@/stores/team'
import type { SvgNames } from '/@/components/rx-icon'
import type { UnwrapRowType, UserGetOperateLogListData } from '@roxy/backend-api'

type Data = UnwrapRowType<UserGetOperateLogListData>

const router = useRouter()
const styles = useCssModule()
const { userPayInfo } = storeToRefs(useUserStore())
const { members } = storeToRefs(useTeamStore())
const { check } = usePermission()

const columns = ref([
  {
    title: $t('成员'),
    key: 'userName',
    render: ({ data }: { data: Data }) => (
      <div>
        <div class={styles['user-email']}>{data.userName}</div>
        <div class={styles['user-name']}>{data.email || data.phone}</div>
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
    slot: 'operateDetail',
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
  const days = LogRetentionDays[userPayInfo.value?.subLevel as SubLevelEnum]

  return [
    {
      type: 'multiple',
      name: 'userNameIds',
      value: [],
      placeholder: $t('全部成员'),
      options: members.value.map(user => ({ label: user.workspaceNickname || user.userName, value: user.user_id })),
    },
    {
      type: 'multiple',
      name: 'operateModule',
      value: [],
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
    {
      type: 'date',
      name: 'date',
      placeholder: $t('全部时间'),
      maxDate: new Date(),
      // 只会保留 60 天内的数据
      minDate: subDays(new Date(), 60),
      formatValue: (input: any, _: any, formData: any) => {
        // 如果用户是免费用户，则只能查询过去3天的数据， 3 天之前需要提示
        if (input.value?.[0] && days < 60) {
          if (differenceInDays(new Date(), new Date(input.value[0])) > days) {
            showToast({
              severity: 'warn',
              summary: $t('您只能查看{days}天内的日志', { days }),
              detail: !check('Cost_Center_all')
                ? $t('如需查看更多日志，请联系团队的拥有者进行升级。')
                : userPayInfo.value.autoRenewDowngrade
                  ? ''// 特殊情况，如果用户是自动续费降级用户，则不显示升级提醒
                  : (
                      <I18nT keypath={$t('如需查看更多历史日志，请{link}', { link: '{link}' })}>
                        {{ link: () => <a class="cursor-pointer align-middle" onClick={upgradePlan}>{$t('单击此处升级')}</a> }}
                      </I18nT>
                    ),
              life: 5000,
            })
            return
          }
        }

        const [startDate, endDate = startDate] = (input.value || []).map((date: Date) => date ? format(date, 'yyyy-MM-dd') : undefined)
        Object.assign(formData, { startDate, endDate })
      },
    },
  ]
}

function upgradePlan() {
  const { userPayInfo } = useUserStore()
  const isFree = [SubLevelEnum.Free, SubLevelEnum.Trial].includes(userPayInfo.subLevel as SubLevelEnum)
  const isExpired = userPayInfo.subLevel === SubLevelEnum.Expired

  if (isFree || isExpired) {
    router.push({ name: 'subscribe-plan' })
  }
  else {
    router.push({ name: 'upgrade-plan' })
  }
}
</script>

<template>
  <div class="flex flex-col w-full h-full operation-logs">
    <div class="flex flex-1 overflow-hidden">
      <RyTable cache-key="history-log-list" :table-filters="tableFilters" :columns="columns" :table-request="tableRequest" :show-actions="false" :show-display="false" :context-menu="false">
        <template #table-empty>
          <CustomEmpty icon="rx_illustration_filter.svg" :title="$t('暂无匹配结果')" :desc="$t('在当前条件下没有匹配结果。请使用其他过滤器再试一次。')" />
        </template>

        <template #operateDetail="{ data }">
          <div v-tooltip.top="{ pt: { root: 'max-w-320px' }, value: data.operateDetail, showDelay: 200, hideDelay: 200 }" class="operate-detail w-240px">
            {{ data.operateDetail }}
          </div>
        </template>

        <template #location="{ data }">
          <div class="flex items-center gap-1 locationip ">
            <SvgIcon :name="(`country-code/${data.code}` as SvgNames)" fallback="base/rx_ic_earth" />
            <div>{{ data.countryCode }}</div>
            <SvgIcon v-tooltip.top="{ value: data.location.replace(';', '\n') }" :tooltip-options="{ placement: 'bottom', showDelay: 500 }" name="base/rx_ic_info" color="var(--colors-icon-icon-note)"
                     :size="14"
            />
          </div>
        </template>
      </RyTable>
    </div>
  </div>
</template>

<style lang="scss" module>
.user-email {
  color: var(--colors-text-text-primary);
  font-family: Inter;
  font-size: 12px;
  font-weight: 600;
  line-height: 16px;
}

.user-name {
  color: var(--colors-text-text-tertiary);
  font-family: Inter;
  font-size: 12px;
  line-height: 16px;
}
</style>

<style lang="scss" scoped>
.description {
  width: 100%;
  color: var(--colors-text-text-tertiary);
  font-family: Inter;
  font-size: 12px;
  font-style: normal;
  font-weight: 400;
  line-height: 16px;
}

.operate-detail {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  overflow: hidden;
  text-overflow: ellipsis;
  word-break: break-all;
  line-height: 1.4;
  white-space: pre-wrap;
}

.locationip {
  color: var(--colors-text-text-primary);
  font-family: Inter;
  font-size: 12px;
  line-height: 16px;
}
</style>
