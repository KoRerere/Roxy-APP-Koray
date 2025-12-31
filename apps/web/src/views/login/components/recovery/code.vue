<script setup lang="ts">
import VerifyModal from '/@/views/login/components/recovery/verify-modal.vue'
import Auth2FA from '/@/layout/components/header/profile/components/auth-2fa/setps-2fa.vue'

import { useLoginContext } from '/@/views/login/hooks/useLoginContext'
import { useThemeStore } from '/@/stores/theme'
import { useDialog } from '/@/hooks/useDialog'
import { API } from '/@/api'
import { useResponseToast } from '/@/hooks/useResponseToast'

interface Props {
  tempToken: string
}

const { tempToken } = defineProps<Props>()
const emit = defineEmits<{
  (e: 'success', data: any): void
}>()

const themeStore = useThemeStore()
const { setCurrentComponent } = useLoginContext()
const [showModal] = useDialog()
const [_, onlyErrorToast] = useResponseToast()

const recoverCode = ref('')
const visible2FA = ref(false)

const imgSrc = computed(() => new URL(`../../../../assets/images/${themeStore.realTheme === 'light' ? 'empty' : 'empty-dark'}/rx_illustration_verification_code.svg`, import.meta.url).href)

async function handleSubmit() {
  const { code, data, msg } = await API.base.checkRecoverCodeCreate({ temp_token: tempToken, recover_code: recoverCode.value })
  onlyErrorToast(code, msg)
  if (code !== 0)
    return
  verifyPassword(data)
}

function verifyPassword(email: string) {
  showModal({
    showHeader: false,
    modal: true,
    blockScroll: true,
    closeOnEscape: false,
    pt: {
      content: '!pa-0',
    },
    slots: {
      container: ({ hideModal }) => h(VerifyModal, {
        email,
        onConfirm: async (formData: any) => {
          const { code, msg } = await API.base.checkEmailPasswordCreate({ temp_token: tempToken, ...formData })
          onlyErrorToast(code, msg)
          if (code !== 0)
            return
          visible2FA.value = true
          hideModal()
        },
        onCancel: () => {
          hideModal()
        },
      }),
    },
  })
}

function hideDialog() {
  visible2FA.value = false
}

async function getLoginBy2FA() {
  const { code, data, msg } = await API.base.get2FaLoginInfoList({ temp_token: tempToken, type: 'recover_code' })

  onlyErrorToast(code, msg)
  if (code !== 0)
    return

  visible2FA.value = false
  emit('success', data)
}
</script>

<template>
  <div class="flex flex-col items-start gap-6">
    <RxButton class="-ml-3" text severity="secondary" icon="base/rx_ic_arrow_left" :label="$t('返回登录')" @click="setCurrentComponent('signForm')" />
    <img class="mx-auto w-32" :src="imgSrc">
    <div class="flex flex-col gap-4">
      <div class="flex flex-col gap-3">
        <div class="description">
          {{ $t('如果您无法访问您的身份验证器应用，请输入其中一个恢复代码来验证您的身份') }}
        </div>
        <InputMask v-model="recoverCode" class="text-center" mask="*****-*****" placeholder="*****-*****" />
      </div>
      <RxButton size="md" class="w-full" :disabled="recoverCode.length !== 11" @click="handleSubmit">
        {{ $t('确认') }}
      </RxButton>
      <i18n-t class="description" tag="div" :keypath="$t('无法使用您的身份验证器应用程序或恢复代码？请{recovery}。', { recovery: '{recovery}' })" scope="global">
        <template #recovery>
          <a class="description-link" @click="$showLiveChat">{{ $t('联系我们') }}</a>
        </template>
      </i18n-t>
    </div>
    <Auth2FA v-model:visible="visible2FA" :temp-token="tempToken" @success="getLoginBy2FA" @cancel="hideDialog" />
  </div>
</template>

<style lang="scss" scoped>
:deep(.p-inputmask) {
  font-family: 'DM Mono';
}

.description {
  color: var(--colors-text-text-tertiary);
  font-size: 12px;
  line-height: 19.2px;

  &-link {
    color: var(--colors-text-text-brand);
    cursor: pointer;
    text-decoration-line: underline;
    text-decoration-style: solid;
    text-decoration-skip-ink: none;
    text-decoration-thickness: auto;
    text-underline-offset: auto;
    text-underline-position: from-font;
  }
}
</style>
