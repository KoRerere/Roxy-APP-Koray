<script setup lang="ts">
import Choose from './choose.vue'
import Proxy from './proxy.vue'
import ThirdParty from './third-party.vue'
import Platform from './platform.vue'
import { AnimatePresence, motion } from 'motion-v'
import { ProxyCheckStatus, WorkspaceType } from '/@/enums'
import { ensureBeforeEnterStep, markPendingEcommerceSkipCreateGuide, setBeforeEnterStep } from '/@/domain/before-enter'
import type { BeforeEnterStep } from '/@/domain/before-enter'
import { useThemeStore } from '/@/stores/theme'
import { useUserStore } from '/@/stores/user'
import { useSimpleLocale } from '/@/stores/locale'
import { useWorkspaceStore } from '/@/stores/workspace'
import { genDefaultProfileByCount } from '/@/views/browser/create/form-inputs'
import { useBeforeEnterFinish } from './useBeforeEnterFinish'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { getImage } from '/@/utils/basic'
import { API } from '/@/api'

const { isDarkTheme } = storeToRefs(useThemeStore())
const { userInfo } = storeToRefs(useUserStore())
const { switchWorkspaceType } = useWorkspaceStore()
const { finishBeforeEnter } = useBeforeEnterFinish()
const [_, onlyErrorToast] = useResponseToast()
const { isZh } = storeToRefs(useSimpleLocale())

const type = ref<BeforeEnterStep>(
  userInfo.value.id != null ? ensureBeforeEnterStep(userInfo.value.id) : 'choose',
)

/** 进入当前步之前的步骤，用于 platform 区分来自 proxy / third */
const prevType = ref<BeforeEnterStep | null>(null)

/** proxy → platform 主路径不展示返回（设备已购）；仅 third → platform 可回退 */
const showBack = computed(() => {
  if (type.value === 'choose') {
    return false
  }
  if (type.value === 'platform' && prevType.value !== 'third') {
    return false
  }
  return true
})

const imageSrcEcommerce = computed(() => {
  const theme = isDarkTheme.value ? 'dark' : 'light'
  return isZh.value ? `/images/roxybrowser1_text_${theme}_zh-CN.svg` : `/images/roxybrowser_text_${theme}_en.svg`
})

const imgSrc = computed(() => {
  return isDarkTheme.value ? getImage('ecommerce/bg_gradient_dark.svg') : getImage('ecommerce/bg_gradient_light.svg')
})

async function onNext(nextType: 'choose' | 'normal' | 'proxy' | 'third' | 'platform') {
  if (nextType === 'normal') {
    await onClose()
    return
  }
  prevType.value = type.value
  type.value = nextType
  if (userInfo.value.id != null) {
    setBeforeEnterStep(userInfo.value.id, nextType)
  }
}

/** 按引导路径回退：platform → 来源设备步；third → proxy；proxy → choose */
function onBack() {
  const current = type.value
  if (current === 'choose') {
    return
  }

  let target: BeforeEnterStep
  if (current === 'platform') {
    // 冷启动恢复到 platform 时无 prev，默认回到主路径 proxy
    target = prevType.value === 'third' || prevType.value === 'proxy'
      ? prevType.value
      : 'proxy'
  }
  else if (current === 'third') {
    target = 'proxy'
  }
  else {
    target = 'choose'
  }

  onNext(target)
}

async function onClose() {
  await finishBeforeEnter({ path: 'skip' })
}

/** 跳过引导：仅切换电商工作区并进入账号列表，不创建默认配置、不走设备列表分流 */
async function onSkip() {
  const { code, msg } = await API.team.userSelectOnboardingWorkspaceTypeCreate({ workspaceType: WorkspaceType.ECommerce })
  onlyErrorToast(code, msg)
  if (code !== 0) {
    return
  }

  await switchWorkspaceType(WorkspaceType.ECommerce)
  markPendingEcommerceSkipCreateGuide()
  await finishBeforeEnter({ path: 'skip', landingRoute: { name: 'ecommerce-account-list' } })
}

async function onSuccess({ data, checkResult }: any) {
  const { code, msg } = await API.team.userSelectOnboardingWorkspaceTypeCreate({ workspaceType: WorkspaceType.ECommerce })
  onlyErrorToast(code, msg)
  if (code !== 0) {
    return
  }

  await switchWorkspaceType(WorkspaceType.ECommerce)
  await genDefaultProfileByCount(1, data)

  const landingRoute = checkResult.checkStatus === ProxyCheckStatus.success || !globalThis.isElectron
    ? { name: 'ecommerce-account-list' }
    : { name: 'ecommerce-device-list' }

  await finishBeforeEnter({ path: 'ecommerce', landingRoute })
}
</script>

<template>
  <AnimatePresence>
    <motion.div class="relative w-screen h-screen flex items-center lock-screen-overlay" :initial="{ opacity: 0, scale: 0.98 }" :animate="{ opacity: 1, scale: 1 }" :exit="{ opacity: 0, scale: 0.98 }"
                :transition="{ duration: 0.25, ease: 'easeInOut' }"
    >
      <img class="absolute w-full h-full object-cover" :src="imgSrc">
      <img class="absolute h-3/5 object-cover" :src="getImage('ecommerce/bg_dot.svg')">
      <div class="relative w-screen h-screen flex justify-center items-center z-3">
        <RxButton v-if="showBack" class="!absolute top-6 left-6 z-1" variant="text" severity="secondary" icon="base/rx_ic_arrow_left" :label="$t('返回')" @click="onBack" />

        <div class="absolute top-6 left-1/2 transform -translate-x-1/2 flex items-center gap-1.5">
          <SvgIcon name="base/logo" size="36" />
          <img draggable="false" class="block h-5" :src="imageSrcEcommerce">
        </div>

        <div class="absolute top-6 right-6 flex items-center gap-2.5 z-1">
          <RxButton v-if="type === 'proxy'" variant="text" severity="secondary" icon="base/rx_ic_import2" :label="$t('导入自有设备')" @click="onNext('third')" />
          <RxButton v-if="type !== 'choose'" class="flex-row-reverse" variant="text" severity="secondary" icon="base/rx_ic_arrow_right_2" :label="$t('跳过')" @click="onSkip" />
        </div>

        <Choose v-show="type === 'choose'" @next="onNext" @close="onClose" />
        <Proxy v-show="type === 'proxy'" @next="onNext" />
        <ThirdParty v-show="type === 'third'" @next="onNext" />
        <Platform v-if="type === 'platform'" @success="onSuccess" />
      </div>
    </motion.div>
  </AnimatePresence>
</template>

<style scoped lang="scss">
.lock-screen-overlay {
  background-color: var(--colors-background-bg-app);
  // background-image: v-bind(bgImage);
  // background-size: cover;
  // background-repeat: no-repeat;
  // background-position: 0;
}
</style>
