<script setup lang="ts">
import TsForm from '/@/views/lab/components/form/index.vue'
import RxVerificationCodeSender from '/@/components/rx-verification-code-sender.vue';
import VerifyModal from '/@/views/login/components/recovery/verify-modal.vue';
import Auth2FA from '/@/layout/components/header/profile/components/auth-2fa/setps-2fa.vue';
import { $t } from '/@/locales'
import { useLoginContext } from '/@/views/login/hooks/useLoginContext'
import { useThemeStore } from '/@/stores/theme'
import { useDialog } from '/@/hooks/useDialog'
import { API } from '/@/api';
import { useResponseToast } from '/@/hooks/useResponseToast';

interface Props {
  tempToken: string
  recoverEmail: string
}

const { tempToken, recoverEmail } = defineProps<Props>()
const emit = defineEmits<{
  (e: 'success', data: any): void
}>()

const themeStore = useThemeStore()
const { setCurrentComponent, getSignFormData, toSignIn } = useLoginContext()
const [showModal] = useDialog()
const [showToast, onlyErrorToast] = useResponseToast()

const wcisRef = useTemplateRef('wcis')
const visible2FA = ref(false)
const imgSrc = computed(() => new URL(`../../../../assets/images/${themeStore.realTheme === 'light' ? 'empty' : 'empty-dark'}/rx_illustration_verification_mail.svg`, import.meta.url).href)

const inputs = ref([
  {
    label: $t('邮箱'),
    name: 'email',
    type: 'text',
    props: {
      placeholder: $t('请输入邮箱'),
    },
  },
  {
    label: $t('验证码'),
    name: 'code',
    render: () => h(RxVerificationCodeSender, {
      placeholder: $t('请输入验证码'),
      request: async () => {
        const email = wcisRef.value?.getFieldState('email')?.value
        const res = await API.base.sendValidatorEmailVerifyCodeList({ email, type: 'modify', temp_token: tempToken })
        if (res.code === 0) {
          showToast(res.code, $t('验证码已发送'))
        }
        return res as any;
      }
    }),
  },
])

async function handleSubmit(formData: any) {
  const { code, data, msg } = await API.base.checkRecoverCodeCreate({ temp_token: tempToken, ...formData })
  onlyErrorToast(code, msg)
  if (code !== 0) return
  verifyPassword(data)
}

function verifyPassword(email: string) {
  showModal({
    showHeader: false,
    modal: true,
    blockScroll: true,
    closeOnEscape: false,
    pt: {
      content: '!pa-0'
    },
    slots: {
      container: ({ hideModal }) => h(VerifyModal, {
        email,
        onConfirm: async (formData: any) => {
          const { code, msg } = await API.base.checkEmailPasswordCreate({ temp_token: tempToken, ...formData })
          onlyErrorToast(code, msg)
          if (code !== 0) return
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
  visible2FA.value = false;
}

async function getLoginBy2FA() {
  const { code, data, msg } = await API.base.get2FaLoginInfoList({ temp_token: tempToken })

  onlyErrorToast(code, msg)
  if (code !== 0) return

  visible2FA.value = false;
  emit('success', data)
}
</script>

<template>
  <div class="flex flex-col items-start gap-6">
    <RxButton class="-ml-3" text severity="secondary" icon="base/rx_ic_arrow_left" :label="$t('返回上一步')" @click="setCurrentComponent('verify2fa')"></RxButton>
    <img class="mx-auto w-32" :src="imgSrc"></img>
    <div class="flex flex-col gap-4">
      <div class="flex flex-col gap-3">
        <div class="description">{{ $t('如果您无法访问您的身份验证器应用，请输入您的恢复邮箱 ({email}) 和代码来验证您的身份', { email: recoverEmail }) }}</div>
        <TsForm ref="wcis" id="wcis" :inputs="inputs" @submit="handleSubmit" />
      </div>
      <RxButton size="md" class="w-full" type="submit" form="wcis">{{ $t('登录') }}</RxButton>
      <i18n-t class="description" tag="div" :keypath="$t('无法使用您的身份验证器应用程序或恢复邮箱？请{recovery}。', { recovery: '{recovery}' })" scope="global">
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
