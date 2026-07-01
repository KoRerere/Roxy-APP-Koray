<script setup lang="ts">
import { API } from '/@/api'
import { useResponseToast } from '/@/hooks/useResponseToast'

import SingleAccount from '/@/views/account/create/quick.vue'
import BatchAccount from './batch-account.vue'
import TemplateImport from './template-import.vue'

const router = useRouter()
const [showToast] = useResponseToast()

const tabs = ref([
  { title: $t('单个添加'), value: 'single' },
  { title: $t('批量添加'), value: 'batch' },
  { title: $t('模板导入'), value: 'template' },
])
const tabsValue = ref('single')

async function saveAccount(formData: any) {
  const { code, msg } = await API.platform.userAddPlatformInfoCreate(formData)
  showToast(code, msg)
}
</script>

<template>
  <div class="flex flex-col h-full w-full overflow-hidden">
    <ViewsHeader show-back :divider="false" :title="$t('添加账号')" />
    <RxTabs v-model:value="tabsValue" :tabs="tabs" />
    <div class="flex-1 flex overflow-hidden">
      <SingleAccount v-show="tabsValue === 'single'" class="mx-auto w-128" @confirm="saveAccount" @close="router.replace({ name: 'account-list' })" />
      <BatchAccount v-show="tabsValue === 'batch'" />
      <TemplateImport v-show="tabsValue === 'template'" class="mx-auto w-152" />
    </div>
  </div>
</template>

<style lang="scss" scoped></style>
