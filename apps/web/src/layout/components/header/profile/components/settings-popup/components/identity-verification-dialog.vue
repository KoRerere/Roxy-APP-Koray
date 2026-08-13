<script setup lang="ts">
import RxTabs from '/@/components/rx-tabs/index.vue'
import { RxAlert } from '/@/components/rx-alert'
import { useResponseToast } from '/@/hooks/useResponseToast'
import IdentityIdUpload from './identity-id-upload.vue'
import {
  formatIdentityRejectedTooltip,
  getIdentityStatus,
  submitIdentityVerification,
  validateKycCreditCode,
  validateKycIdNumber,
  type IdentityVerificationType,
} from '../identity-verification'
import { useProxyShopLabels } from '/@/views/agent/shop/utils/proxy-shop-labels'

const props = defineProps<{
  defaultTab?: IdentityVerificationType
  /** 代理导出/二维码 KYC 拦截跳转时展示法规说明 */
  showRegulatoryNotice?: boolean
  /** 审核未通过重新提交时展示失败原因（与法规说明互斥） */
  showRejectedNotice?: boolean
  onSuccess: () => void
}>()

const [showToast, onlyErrorToast] = useResponseToast()
const proxyLabels = useProxyShopLabels()
const identityInfo = getIdentityStatus()

const activeTab = ref(props.defaultTab ?? 'personal')
const agreed = ref(false)
const submitting = ref(false)

/** 顶部 Alert 文案：失败原因优先于法规说明 */
const noticeText = computed(() => {
  if (props.showRejectedNotice)
    return formatIdentityRejectedTooltip(identityInfo.value.rejectedReasons)
  if (props.showRegulatoryNotice)
    return proxyLabels.value.exportRequiresKycDesc
  return ''
})

const showNoticeAlert = computed(() => !!noticeText.value)

const personalForm = reactive({
  realName: '',
  idNumber: '',
  idFront: '',
  idBack: '',
})

const enterpriseForm = reactive({
  companyName: '',
  creditCode: '',
  legalName: '',
  idNumber: '',
  license: '',
})

const tabs = computed(() => [
  { title: $t('个人认证'), value: 'personal' },
  { title: $t('企业认证'), value: 'enterprise' },
])

const personalIdNumberTouched = ref(false)
const enterpriseCreditCodeTouched = ref(false)
const enterpriseIdNumberTouched = ref(false)

watch(activeTab, () => {
  personalIdNumberTouched.value = false
  enterpriseCreditCodeTouched.value = false
  enterpriseIdNumberTouched.value = false
})

const personalIdNumberError = computed(() => {
  if (!personalIdNumberTouched.value)
    return ''
  const value = personalForm.idNumber.trim()
  if (!value)
    return $t('请输入身份证号码')
  if (!validateKycIdNumber(value))
    return $t('请输入正确的身份证号码')
  return ''
})

const enterpriseCreditCodeError = computed(() => {
  if (!enterpriseCreditCodeTouched.value)
    return ''
  const value = enterpriseForm.creditCode.trim()
  if (!value)
    return $t('请输入社会统一信用代码')
  if (!validateKycCreditCode(value))
    return $t('请输入正确的社会统一信用代码')
  return ''
})

const enterpriseIdNumberError = computed(() => {
  if (!enterpriseIdNumberTouched.value)
    return ''
  const value = enterpriseForm.idNumber.trim()
  if (!value)
    return $t('请输入身份证号')
  if (!validateKycIdNumber(value))
    return $t('请输入正确的身份证号码')
  return ''
})

const canSubmit = computed(() => {
  if (!agreed.value)
    return false

  if (activeTab.value === 'personal') {
    return personalForm.realName.trim()
      && validateKycIdNumber(personalForm.idNumber)
      && personalForm.idFront
      && personalForm.idBack
  }

  return enterpriseForm.companyName.trim()
    && validateKycCreditCode(enterpriseForm.creditCode)
    && enterpriseForm.legalName.trim()
    && validateKycIdNumber(enterpriseForm.idNumber)
    && enterpriseForm.license
})

function resolveSubmitErrorMsg(msg: string) {
  if (msg === 'INVALID_KYC_ID_NUMBER')
    return $t('请输入正确的身份证号码')
  if (msg === 'INVALID_KYC_CREDIT_CODE')
    return $t('请输入正确的社会统一信用代码')
  return msg
}

async function handleSubmit() {
  if (!canSubmit.value)
    return

  submitting.value = true
  try {
    const type = activeTab.value as IdentityVerificationType
    const payload = type === 'personal'
      ? { ...personalForm }
      : { ...enterpriseForm }

    const { code, msg } = await submitIdentityVerification(type, payload)
    if (code !== 0) {
      onlyErrorToast(code, resolveSubmitErrorMsg(msg))
      return
    }
    showToast(0, $t('提交成功，请等待审核'))
    props.onSuccess()
  }
  finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="identity-form">
    <RxAlert
      v-if="showNoticeAlert"
      :visible="true"
      :type="showRejectedNotice ? 'error' : 'info'"
      :closable="false"
      class="w-full"
    >
      <template #content>
        <p class="identity-form__notice" :class="{ 'whitespace-pre-wrap': showRejectedNotice }">
          {{ noticeText }}
        </p>
      </template>
    </RxAlert>

    <RxTabs v-model:value="activeTab" :tabs="tabs" head-tabs only-tabs class="identity-form__tabs" />

    <div v-if="activeTab === 'personal'" class="identity-form__fields">
      <div class="form-field">
        <label class="form-field__label">
          {{ $t('真实姓名') }}
          <span class="form-field__required">*</span>
        </label>
        <InputText v-model="personalForm.realName" class="w-full !text-3.5" :placeholder="$t('请输入真实姓名')" />
      </div>
      <div class="form-field">
        <label class="form-field__label">
          {{ $t('身份证号码') }}
          <span class="form-field__required">*</span>
        </label>
        <InputText
          v-model="personalForm.idNumber"
          class="w-full !text-3.5"
          :placeholder="$t('请输入身份证号码')"
          :invalid="!!personalIdNumberError"
          @blur="personalIdNumberTouched = true"
        />
        <p v-if="personalIdNumberError" class="form-field__error">
          {{ personalIdNumberError }}
        </p>
      </div>
      <div class="form-field">
        <label class="form-field__label">
          {{ $t('上传身份证') }}
          <span class="form-field__required">*</span>
        </label>
        <p class="form-field__hint">
          {{ $t('建议图片大小不超过4MB，超过将自动压缩；支持 jpg、jpeg、png 等格式') }}
        </p>
        <div class="identity-form__uploads">
          <IdentityIdUpload
            v-model="personalForm.idFront"
            :label="$t('上传')"
            :highlight="$t('身份证人像面')"
          />
          <IdentityIdUpload
            v-model="personalForm.idBack"
            :label="$t('上传')"
            :highlight="$t('身份证国徽面')"
          />
        </div>
      </div>
    </div>

    <div v-else class="identity-form__fields">
      <div class="form-field">
        <label class="form-field__label">
          {{ $t('企业名称') }}
          <span class="form-field__required">*</span>
        </label>
        <InputText v-model="enterpriseForm.companyName" class="w-full !text-3.5" :placeholder="$t('请输入企业名称')" />
      </div>
      <div class="form-field">
        <label class="form-field__label">
          {{ $t('社会统一信用代码') }}
          <span class="form-field__required">*</span>
        </label>
        <InputText
          v-model="enterpriseForm.creditCode"
          class="w-full uppercase !text-3.5"
          :placeholder="$t('请输入社会统一信用代码')"
          :invalid="!!enterpriseCreditCodeError"
          @blur="enterpriseCreditCodeTouched = true"
        />
        <p v-if="enterpriseCreditCodeError" class="form-field__error">
          {{ enterpriseCreditCodeError }}
        </p>
      </div>
      <div class="form-field">
        <label class="form-field__label">
          {{ $t('法人姓名') }}
          <span class="form-field__required">*</span>
        </label>
        <InputText v-model="enterpriseForm.legalName" class="w-full !text-3.5" :placeholder="$t('请输入法人姓名')" />
      </div>
      <div class="form-field">
        <label class="form-field__label">
          {{ $t('身份证号') }}
          <span class="form-field__required">*</span>
        </label>
        <InputText
          v-model="enterpriseForm.idNumber"
          class="w-full !text-3.5"
          :placeholder="$t('请输入身份证号')"
          :invalid="!!enterpriseIdNumberError"
          @blur="enterpriseIdNumberTouched = true"
        />
        <p v-if="enterpriseIdNumberError" class="form-field__error">
          {{ enterpriseIdNumberError }}
        </p>
      </div>
      <div class="form-field">
        <label class="form-field__label">
          {{ $t('上传营业执照') }}
          <span class="form-field__required">*</span>
        </label>
        <p class="form-field__hint !mb-2">
          {{ $t('建议图片大小不超过4MB，超过将自动压缩；支持 jpg、jpeg、png 等格式') }}
        </p>
        <IdentityIdUpload
          v-model="enterpriseForm.license"
          :label="$t('点击上传 / 拖拽 图片到此处')"
        />
      </div>
    </div>

    <div class="identity-form__footer">
      <RxButton
        class="w-full"
        :label="$t('提交审核')"
        :disabled="!canSubmit"
        :loading="submitting"
        @click="handleSubmit"
      />
      <div class="identity-form__agreement">
        <RxCheckbox v-model="agreed" binary input-id="identity-agreement" />
        <label for="identity-agreement" class="identity-form__agreement-text">
          {{ $t('本人确认所提供的信息是完整、准确和有效的，且同意将上述信息发送给RoxyBrowser，以遵守适用的法规和法律。本人应对因未提供完整、准确、有效的信息而造成的任何及所有损失和后果负责。') }}
        </label>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.identity-form {
  display: flex;
  flex-direction: column;
  gap: 20px;

  &__notice {
    margin: 0;
    font-size: 12px;
    line-height: 19.2px;
    color: var(--colors-text-text-primary);
  }

  &__tabs {
    :deep(.p-tablist-tab-list) {
      padding-left: 4px;
      padding-right: 4px;
    }
  }

  &__fields {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  &__uploads {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
    margin-top: 8px;
  }

  &__footer {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  &__agreement {
    display: flex;
    gap: 6px;
    align-items: flex-start;
  }

  &__agreement-text {
    flex: 1;
    font-size: 12px;
    line-height: 18px;
    color: var(--colors-text-text-tertiary, #575d60);
    cursor: pointer;
  }
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 4px;

  &__label {
    font-size: 12px;
    font-weight: 600;
    line-height: 20px;
    color: var(--colors-text-text-primary);
  }

  &__required {
    color: var(--colors-text-text-error, #f53838);
  }

  &__hint {
    margin: 0;
    font-size: 12px;
    color: var(--colors-text-text-tertiary, #575d60);
  }

  &__error {
    margin: 0;
    font-size: 12px;
    line-height: 16px;
    color: var(--colors-text-text-error, #f53838);
  }
}
</style>
