<script setup lang="ts">
import { useToast } from 'primevue/usetoast'
import { API } from '/@/api'

const props = defineProps<{
  token: string
  closeCallback: () => void
  onFinish: () => void
}>()

const loading = ref(false)
const toast = useToast()

async function handleMigration() {
  loading.value = true
  const { promise, resolve, reject } = Promise.withResolvers()
  const startTimestamp = Date.now()
  const { code, data, msg } = await API.base.userMigrateDataList({ headers: { token: props.token } }).catch(() => {
    loading.value = false
  })
  if (code !== 0) {
    toast.add({ severity: 'error', summary: 'Error', detail: msg, life: 2500 })
    reject(msg)
    return
  }
  const endTimestamp = Date.now()

  // 最小等待时间 3 秒
  const waitTime = Math.max(endTimestamp - startTimestamp, 3000)
  setTimeout(() => {
    props.onFinish()
    props.closeCallback()
    loading.value = false
    resolve(true)
  }, waitTime)

  return promise
}
</script>

<template>
  <div class="migration-tips">
    <div class="title">
      {{ $t('关于从 Lumibrowser 中迁移数据的公告') }}
    </div>
    <div class="content">
      <span>{{ $t('你好，我们发现你的账号在 Lumibrowser 中已存在数据，为了更好地使用我们的产品，请点击下方的按钮进行数据迁移。') }}</span>
      <span>{{ $t('该次数据迁移仅会执行一次，当你执行完数据迁移后才能继续使用 RoxyBrowser。') }}</span>
      <span>
        <i18n-t :keypath="$t('关于更多数据迁移的细节，包括窗口的转换和权限的变更，请访问：{link}', { link: '{link}' })" scope="global">
          <template #link>
            <a href="https://roxybrowser.com" target="_blank" class="upload-title-link">{{ $t('roxybrowser.com') }}</a>
          </template>
        </i18n-t>
      </span>
    </div>
    <div class="footer">
      <RxButton :disabled="loading" @click="closeCallback">
        {{ $t('暂不迁移') }}
      </RxButton>
      <RxButton @click="handleMigration">
        {{ $t('立即迁移') }}
      </RxButton>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.migration-tips {
  display: flex;
  width: var(--width-sm, 480px);
  padding: var(--spacing-4xl, 24px);
  flex-direction: column;
  align-items: flex-start;
  gap: var(--spacing-2xl, 16px);
}

.title {
  color: var(--Colors-Text-text-primary, #171c1f);
  font-family: Inter;
  font-size: 14px;
  font-style: normal;
  font-weight: 600;
  line-height: var(--Line-Height-text-lg, 20px);
  margin-bottom: 12px;
}

.content {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--spacing-md, 12px);
  align-self: stretch;
  color: var(--Colors-Text-text-secondary, #575d61);
  font-family: 'PingFang SC';
  font-size: 12px;
  font-style: normal;
  font-weight: 400;
  line-height: var(--Line-Height-text-sm, 18px); /* 150% */
}

.footer {
  display: flex;
  align-self: stretch;
  justify-content: space-between;
  gap: var(--spacing-md, 6px);
  align-items: center;
  margin-top: 12px;
}
</style>
