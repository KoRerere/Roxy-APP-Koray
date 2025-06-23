<script setup lang="ts">
import { $t } from '/@/locales'
import TsForm from '/@/views/lab/components/form/index.vue'

interface Props {
  email: string
  afterRender?: any
  onConfirm?: (formData: any) => Promise<void> | void
  onCancel?: () => void
}

const { email, onConfirm, onCancel } = defineProps<Props>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const loading = ref(false)

const inputs = ref([
  {
    label: $t('邮箱'),
    name: 'email',
    type: 'text',
    value: email,
    props: {
      placeholder: $t('请输入邮箱'),
      disabled: true,
    },
  },
  {
    label: $t('密码'),
    name: 'password',
    type: 'password',
    props: {
      placeholder: $t('请输入密码'),
    },
    resolver: (z: any) => z.string().min(1, $t('请输入密码'))
  },
])


function close() {
  onCancel?.()
  emit('close')
}

async function onSubmit(formData: any) {
  loading.value = true
  await onConfirm?.(formData)
  loading.value = false
  emit('close')
}

</script>

<template>
  <div class="flex flex-col gap-4 pt-4 pb-6 px-6 w-120">
    <div class="title">Enter your password</div>
    <div class="content">For your account security, the current operation requires you to enter your account password.</div>
    <TsForm id="verify" :inputs="inputs" @submit="onSubmit" />
    <RxButton class="w-full mt-2" size="lg" :label="$t('下一步')" type="submit" form="verify" :loading="loading" />
  </div>
</template>

<style lang="scss" scoped>
.title {
  color: var(--colors-text-text-primary);
  font-size: 14px;
  font-weight: 500;
  line-height: normal;
}

.content {
  color: var(--colors-text-text-secondary);
  font-size: 12px;
  line-height: 18px;
}
</style>
