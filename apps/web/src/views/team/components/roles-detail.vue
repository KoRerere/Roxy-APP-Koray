<script setup lang="ts">
import VerificationModel from '/@/views/team/components/verification-model.vue'
import { API } from '/@/api'
import { useDialog } from '/@/hooks/useDialog'
import { useResponseToast } from '/@/hooks/useResponseToast'

const { role, userId, readonly = false } = defineProps<{
  role?: string
  userId?: number
  readonly?: boolean
  title?: string
}>()

defineEmits(['close'])

const [showModal] = useDialog()
const [_, onlyErrorToast] = useResponseToast()

const loading = ref(false)
const list = ref()
const moduleNameStr = {
  API_MCP: 'API & AI MCP',
  Platform: $t('平台账号'),
  Plugin_Installed: $t('扩展中心'),
  Plugin_Recommend: $t('扩展推荐'),
  Profiles: $t('全部窗口'),
  Profiles_Label: $t('标签管理'),
  Projects: $t('项目管理'),
  Proxy_List: $t('代理 IP 列表'),
  Proxy_Store: $t('代理 IP 商店'),
  Team_Log: $t('操作日志'),
  Team_Member: $t('团队成员'),
  Team_Transfer: $t('转移历史'),
  Cost_Center: $t('费用中心'),
}

onMounted(() => {
  getPermissionsByRole()
})

async function getPermissionsByRole() {
  loading.value = true
  const { code, data, msg } = await API.team.userGetRolePermissionsList({ role, userId: userId?.toString() })
  loading.value = false
  onlyErrorToast(code, msg)
  if (code !== 0)
    return
  list.value = data.rows
}

async function checkDangerPermission(status: boolean, item: any, group: { permissions: any[] }, index: number) {
  if (status === false || !item.isSensitive) {
    return permissionChange({ status }, item, group, index)
  }

  const { code, data, msg } = await API.team.userGetTeamPermissionVerifyStatusList()
  onlyErrorToast(code, msg)
  if (code !== 0)
    return false

  if (data.verified) {
    return permissionChange({ status }, item, group, index)
  }

  const { promise, resolve } = Promise.withResolvers<boolean>()

  showModal({
    showHeader: false,
    modal: true,
    blockScroll: true,
    closeOnEscape: false,
    slots: {
      container: ({ hideModal }) => h(VerificationModel, {
        onClose: () => {
          hideModal()
          resolve(false)
        },
        onConfirm: async (code: string) => {
          console.log('🚀 ~ checkDangerPermission ~ code:', code)
          const result = await permissionChange({ status, code }, item, group, index)
          if (result) {
            hideModal()
            resolve(result)
          }
        },
      }),
    },
  })

  return promise
}

async function permissionChange(data: { status: boolean, code?: string }, item: any, group: { permissions: any[] }, index: number) {
  console.log('🚀 ~ permissionChange ~ data:', data)
  const perms = group.permissions
  const first = perms[0]
  let permissions: { permissionCode: string, hasPermission: boolean }[]

  if (index === 0) {
    if (!data.status) {
      permissions = perms
        .filter((p: any) => p.configurable)
        .map((p: any) => ({ permissionCode: p.permissionCode, hasPermission: false }))
    }
    else {
      permissions = [{ permissionCode: item.permissionCode, hasPermission: true }]
    }
  }
  else if (data.status) {
    permissions = []
    if (first?.configurable && !first.hasPermission)
      permissions.push({ permissionCode: first.permissionCode, hasPermission: true })
    permissions.push({ permissionCode: item.permissionCode, hasPermission: true })
  }
  else {
    permissions = [{ permissionCode: item.permissionCode, hasPermission: false }]
  }

  const { code, msg } = await API.team.userUpdateTeamPermissionsCreate({
    userId,
    permissions,
    emailCode: data.code ?? '',
  })
  onlyErrorToast(code, msg)
  if (code !== 0)
    return false

  for (const p of permissions) {
    const perm = perms.find((x: any) => x.permissionCode === p.permissionCode)
    if (perm)
      perm.hasPermission = p.hasPermission
  }
  return true
}
</script>

<template>
  <div class="w-140 flex flex-col gap-4 pa-6 pt-4">
    <div class="min-h-9 flex flex-col gap-1">
      <div class="flex items-center justify-between">
        <div class="title">
          {{ title || $t('权限详情') }}
        </div>
        <SvgIcon class="cursor-pointer" name="base/rx_ic_delete" size="20" @click="$emit('close')" />
      </div>
      <div v-if="readonly" class="desc">
        {{ $t('可在团队成员列表进行权限修改') }}
      </div>
    </div>
    <div class="relative min-h-30 max-h-70vh rounded-2 overflow-y-auto grid gap-x-4 items-center content">
      <RxLoading v-model="loading" :opacity="1" />
      <template v-for="(group, gIndex) in list ?? []" :key="group.moduleName">
        <template v-for="(item, index) in group.permissions" :key="item.permissionCode">
          <span class="title shrink-0 py-3 pl-3" :class="{ 'opacity-0': index !== 0 }">{{ moduleNameStr[group.moduleName as keyof typeof moduleNameStr] }}</span>
          <span class="name min-w-0 py-3 flex items-center gap-1.5">
            <span>{{ item.permissionName }}</span>
            <SvgIcon v-if="item.permissionCode === 'Cost_Center_all'" v-tooltip.top="$t('开启后，用户将完全接管空间拥有者的资产权限，包含钱包、续订、银行卡、窗口、空间、成员、代理 IP 等资产的详情查看、信息修改和购买权限，消费将会从空间所有者钱包内扣款。')" class="cursor-pointer" name="base/rx_ic_info" size="14" color="var(--colors-icon-icon-note)" />
          </span>
          <div class="flex shrink-0 items-center justify-end py-3 pr-6">
            <template v-if="item.configurable">
              <div v-if="readonly" class="flex items-center gap-1">
                <span class="tip">{{ $t('可修改') }}</span>
                <SvgIcon v-tooltip.top="$t('可在团队成员列表进行权限修改')" class="cursor-pointer" name="base/rx_ic_info" size="14" color="var(--colors-icon-icon-note)" />
              </div>
              <RxToggleSwitch v-else v-model="item.hasPermission" :before-change="(status) => checkDangerPermission(status, item, group, Number(index))" />
            </template>
            <SvgIcon v-else name="base/rx_ic_check" color="var(--colors-icon-icon-brand)" />
          </div>
        </template>
        <div v-if="Number(gIndex) < (list?.length ?? 0) - 1" class="group-separator" aria-hidden="true" />
      </template>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.content {
  border: 1px solid var(--colors-border-border-overlay);
  background: var(--colors-background-bg-overlay);
  grid-template-columns: max-content 1fr auto;
}

.group-separator {
  grid-column: 1 / -1;
  height: 0;
  border-bottom: 1px solid var(--colors-border-border-overlay);
}

.title {
  color: var(--colors-text-text-primary);
  font-size: 14px;
  font-weight: 600;
  line-height: normal;
}

.desc {
  color: var(--colors-text-text-placeholder);
  font-size: 13px;
  line-height: 20px;
}

.name {
  color: var(--colors-text-text-primary);
  font-size: 14px;
  line-height: normal;
}

.tip {
  color: var(--colors-text-text-inactive);
  font-size: 12px;
}
</style>
