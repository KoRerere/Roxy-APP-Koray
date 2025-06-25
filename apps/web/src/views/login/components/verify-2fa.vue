<script setup lang="ts">
import { RxAlert } from '/@/components/rx-alert/'
import { $t } from '/@/locales'
import { useLoginContext } from '../hooks/useLoginContext'
import { useThemeStore } from '/@/stores/theme'

interface Props {
  recoverType: 'code' | 'email' | (string & {})
  recover?: boolean
}

const { recoverType, recover = true } = defineProps<Props>()

const emit = defineEmits<{
  (e: 'submit', faCode: string): void
}>()

const themeStore = useThemeStore()
const { setCurrentComponent } = useLoginContext()

const isShowAlert = ref(false)
const fa_code = ref('')

const imgSrc = computed(() => new URL(`../../../assets/images/${themeStore.realTheme === 'light' ? 'empty' : 'empty-dark'}/rx_illustration_verification.svg`, import.meta.url).href)


function onSubmit() {
  if (fa_code.value.length !== 6) return
  emit('submit', fa_code.value)
  fa_code.value = ''
}
</script>

<template>
  <div class="flex flex-col items-start gap-6" @keydown.enter="onSubmit">
    <RxAlert v-model:visible="isShowAlert" class="w-full" :title="$t('无效的验证码')" type="error" />
    <RxButton class="-ml-3" text severity="secondary" icon="base/rx_ic_arrow_left" :label="$t('返回上一步')" @click="setCurrentComponent('signForm')"></RxButton>
    <img class="mx-auto w-32" :src="imgSrc"></img>
    <div class="flex flex-col gap-4">
      <div class="description">{{ $t('请检查身份验证器应用以获取验证码。') }}</div>
      <InputOtp v-model="fa_code" class="inputotp" :length="6" />
      <RxButton class="w-full" size="md" :disabled="fa_code.length !== 6" @click="onSubmit">{{ $t('确认') }}</RxButton>
      <i18n-t v-if="recover" class="description" tag="div" :keypath="$t('无法登录？请{recovery}。', { recovery: '{recovery}' })" scope="global">
        <template #recovery>
          <a v-if="recoverType === 'code'" class="description-link" @click="setCurrentComponent('recoveryCode')">{{ $t('使用恢复代码') }}</a>
          <a v-else class="description-link" @click="setCurrentComponent('recoveryEmail')">{{ $t('使用恢复邮箱') }}</a>
        </template>
      </i18n-t>
    </div>
  </div>
</template>

<style lang="scss" scoped>
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

.inputotp {
  gap: 6px;

  :deep(.p-inputotp-input) {
    display: flex;
    width: 67px;
    height: 76px;
    flex-direction: column;
    justify-content: center;
    flex-shrink: 0;
    color: var(--colors-text-text-primary);
    text-align: center;
    font-family: 'JetBrains Mono';
    font-size: 24px;
    font-style: normal;
    font-weight: 400;
    line-height: normal;
    text-transform: uppercase;
  }
}
</style>
