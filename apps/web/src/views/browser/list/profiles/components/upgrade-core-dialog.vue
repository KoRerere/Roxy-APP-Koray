<script setup lang="ts">
import { RxAlert } from '/@/components/rx-alert'

const { messages, confirmUpgrade, close } = defineProps<{
  /** 按目标内核版本拆开的说明，例如「[工作区-1]窗口将升级到 Chrome 149内核版本」 */
  messages: string[]
  confirmUpgrade: () => Promise<void>
  close: () => void
}>()

const loading = ref(false)

/** 失败时保持弹窗，便于直接重试；成功后由调用方关闭 */
async function submit() {
  if (loading.value) {
    return
  }
  loading.value = true
  try {
    await confirmUpgrade()
    close()
  }
  catch (error) {
    console.warn('[upgradeCore] update failed', error)
  }
  finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="flex flex-col gap-3 w-120 px-6 pt-4 pb-6">
    <div class="text-14px font-medium text-[var(--colors-text-text-primary)]">
      {{ $t('升级内核') }}
    </div>
    <div class="flex flex-col gap-1">
      <div
        v-for="(message, index) in messages"
        :key="index"
        class="text-12px leading-18px text-[var(--colors-text-text-secondary)] break-all"
      >
        {{ message }}
      </div>
    </div>
    <RxAlert
      class="!w-full"
      type="warn"
      :closable="false"
      :content="$t('修改内核可能导致缓存不兼容，从而使账号登录信息失效，请谨慎操作。')"
    />
    <div class="flex justify-end items-center gap-3">
      <RxButton size="sm" text severity="secondary" :label="$t('取消')" :disabled="loading" @click="close" />
      <RxButton size="sm" :label="$t('确认')" :loading="loading" @click="submit" />
    </div>
  </div>
</template>
