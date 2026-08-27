<script setup lang="ts">
import { RxAlert } from '/@/components/rx-alert'

interface Props {
  /** 本次购买的终身窗口数量 */
  purchaseCount: number
}

const { purchaseCount } = defineProps<Props>()
const emit = defineEmits<{
  (e: 'close'): void
}>()

const router = useRouter()

/** 关闭成功弹窗并前往创建浏览器窗口 */
function onView() {
  emit('close')
  router.push({ name: 'wallet' })
}

/** 关闭成功弹窗 */
function close() {
  emit('close')
}
</script>

<template>
  <div class="flex flex-col pt-4 gap-4 overflow-hidden w-140">
    <div class="h-10 relative flex justify-between items-center px-6">
      <span class="tt-primary text-4 font-600 leading-normal">{{ $t('购买终身窗口') }}</span>
      <SvgIcon class="cursor-pointer" size="20" name="base/rx_ic_delete" color="var(--colors-icon-icon-secondary)" @click="close" />
    </div>

    <div class="flex flex-col gap-5 items-center px-6 pb-6">
      <div class="flex flex-col gap-7 items-center pt-10 w-full">
        <div class="flex flex-col gap-3 items-center">
          <SvgIcon name="base/rx_ic_check_fill" size="48" color="#1CC94D" />
          <div class="flex flex-col gap-2 items-center">
            <div class="tt-primary text-5 font-600 leading-[1.4] text-center">
              {{ $t('购买成功') }}
            </div>
            <div class="tt-tertiary text-4 leading-6 text-center">
              {{ $t('您已成功购买 {count} 个终身窗口。', { count: purchaseCount }) }}
            </div>
          </div>
        </div>

        <RxAlert class="w-full" type="info" :closable="false">
          <template #title>
            <i18n-t scope="global" :keypath="$t('终身窗口已加入「我的资源」，可立即用于创建浏览器窗口。{view}', { view: '{view}' })">
              <template #view>
                <span class="text-[var(--colors-text-text-brand)] cursor-pointer" @click="onView">{{ $t('查看') }}</span>
              </template>
            </i18n-t>
          </template>
        </RxAlert>
      </div>

      <RxButton class="w-full" size="lg" :label="$t('确认')" @click="close" />
    </div>
  </div>
</template>
