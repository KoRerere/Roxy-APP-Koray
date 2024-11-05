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
    <div class="content">
      <span>
        <i18n-t :keypath="$t('为了提供更好的体验，我们已推出全新版本的客户端，并正式更名为 RoxyBrowser。点击 {link} 了解详情。', { link: '{link}' })" scope="global">
          <template #link>
            <a href="https://roxybrowser.com/" target="_blank">roxybrowser.com</a>
          </template>
        </i18n-t>
      </span>
    </div>

    <div class="title">
      {{ $t('数据迁移说明：') }}
    </div>
    <div class="content">
      <span>{{ $t('1. Lumibrowser 中的所有窗口、代理、扩展等数据将自动同步至 RoxyBrowser 默认工作空间（每位用户将拥有专属工作空间）') }}</span>
      <span>
        <i18n-t :keypath="$t('2. {desc}：团队中的窗口将归属主账号的工作空间，并由主账号统一管理（窗口数据归于主账号，代理及扩展数据仍为个人所有），主账号可以通过邀请，使成员加入工作空间并分配相应权限。', { desc: '{desc}' })" scope="global">
          <template #desc>
            <b>团队迁移说明</b>
          </template>
        </i18n-t>
      </span>
      <span>
        <i18n-t :keypath="$t('3. 所有原分组信息将转变为{tag}，并自动与相关窗口绑定以区分。', { tag: '{tag}' })" scope="global">
          <template #tag>
            <b>标签</b>
          </template>
        </i18n-t>
      </span>
      <span>{{ $t('4. 该次数据迁移仅会执行一次，当你执行完数据迁移后才能继续使用 RoxyBrowser。') }}</span>
    </div>
    <div class="footer">
      <RxButton :disabled="loading" outlined severity="secondary" @click="closeCallback">
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
