<script setup lang="ts">
import TsForm from '/@/views/lab/components/form/index.vue'
import TsFormInputText from '/@/views/lab/components/form/m-input-text.vue'
import MemberInfo from '/@/views/team/components/member-info.vue'
import Fuse from 'fuse.js'
import { useUserStore } from '/@/stores/user'
import { useTeamStore } from '/@/stores/team'
import { useDebounceFn } from '@vueuse/core'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { API } from '/@/api'
import { getRoleLabelMap, Role } from '/@/enums/role'
import { useProjectEntityLabels } from '/@/composables/useProjectEntityLabels'

const { data, onSuccess } = defineProps<{
  data?: Record<string, any>
  onClose: () => void
  onSuccess: () => void
}>()

const { userInfo } = storeToRefs(useUserStore())
const { getTeamMembers } = useTeamStore()
const [_, onlyErrorToast] = useResponseToast()
const projectLabels = useProjectEntityLabels()

const roleLabelMap = getRoleLabelMap()
const loading = ref(false)
const members = ref()
const fuse = ref()
const search = ref()
const searchResult = ref()
const selectedMembers = ref()
const inputs = computed(() => {
  const labels = projectLabels.value
  return [
    {
      type: 'text',
      name: 'projectName',
      value: data?.projectName,
      props: {
        placeholder: labels.namePlaceholder,
        size: 'lg',
      },
      resolver: (zod: any) => zod.string()
        .min(1, labels.nameRequired)
        .min(2, labels.nameMinLength)
        .max(30, labels.nameMaxLength),
    },
  ]
})

const memberList = computed(() => search.value ? searchResult.value : members.value)

const searchMembers = useDebounceFn(() => {
  const list = fuse.value?.search(search.value).map((res: any) => toRaw(res.item))
  searchResult.value = list
}, 200)

onMounted(() => {
  getMemberList()
})

async function getMemberList() {
  loading.value = true
  const { code, data, msg } = await getTeamMembers()
  loading.value = false
  onlyErrorToast(code, msg)
  if (code !== 0) {
    return
  }

  fuse.value = new Fuse(data.rows, {
    threshold: 0.3,
    keys: ['userName', 'workspaceNickname', 'email'],
  })

  selectedMembers.value = data.rows.filter((item: any) => item.role === Role.OWNER || item.role === Role.MANAGER || item.userId === userInfo.value.id).map(item => item.userId)
  members.value = data.rows.filter(item => item.userId)
}

const subloading = ref(false)

async function handleSubmit(formData: Record<string, any>) {
  subloading.value = true
  const { code, msg } = await API.limit.userAddProjectInfoCreate({
    relatedUserIds: toRaw(selectedMembers.value),
    ...formData,
  } as any)
  subloading.value = false
  onlyErrorToast(code, msg)
  if (code !== 0) {
    return
  }
  await onSuccess()
}
</script>

<template>
  <div class="flex flex-col pa-6 pt-4 gap-6 w-120">
    <div class="h-9 flex justify-between items-center">
      <div class="tt-primary text-4 font-600">
        {{ projectLabels.createTitle }}
      </div>
      <SvgIcon class="cursor-pointer" name="base/rx_ic_delete" size="20" @click="onClose" />
    </div>
    <TsForm id="gen_project" class="-mt-2" :inputs="inputs" @submit="handleSubmit" />
    <RxDivider line-only line-color="var(--component-dropdown-divider)" />
    <div class="flex flex-col gap-5 relative w-full">
      <RxLoading v-model="loading" :opacity="0.8" />
      <div class="inline-flex justify-between items-center">
        <div class="shrink-0 tt-primary text-3.5 font-500 leading-5">
          {{ $t('添加成员') }}
        </div>
        <TsFormInputText v-model="search" :field-props="{ class: '!w-auto' }" pre-icon="base/rx_ic_magnify" :placeholder="$t('搜索成员')" @input="searchMembers" />
      </div>
      <RxMaskScroll v-if="memberList?.length > 0" class="max-h-60">
        <div class="-mx-6 px-6 flex flex-col gap-4">
          <div v-for="item in memberList" :key="item.userId" class="flex items-center gap-2 select-none">
            <RxCheckbox v-model="selectedMembers" :disabled="item.role === Role.OWNER || item.role === Role.MANAGER || item.userId === userInfo.id" :input-id="item.userId.toString()"
                        :value="item.userId" name="members"
            />
            <label class="flex-1 overflow-hidden" :for="item.userId.toString()">
              <div class="flex items-center gap-3">
                <MemberInfo class="flex-1" :avatar="item.avatar" :avatar-color="item.avatarColor" :user-name="item.workspaceNickname || item.userName" :nick-name="item.workspaceNickname"
                            :email="item.email" :phone="item.phone"
                />
                <RxTag disabled :label="roleLabelMap[item.role as keyof typeof roleLabelMap]" />
              </div>
            </label>
          </div>
        </div>
      </RxMaskScroll>
      <RxButton class="self-end" size="md" form="gen_project" type="submit" :loading="subloading" :label="$t('确认')" />
    </div>
  </div>
</template>

  <style lang="scss" scoped></style>
