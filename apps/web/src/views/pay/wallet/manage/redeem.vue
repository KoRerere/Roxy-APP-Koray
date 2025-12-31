<script setup lang="tsx">
import TsFormInputText from '/@/views/lab/components/form/m-input-text.vue'
;
import { API } from '/@/api';
import { useResponseToast } from '/@/hooks/useResponseToast';

const [showToast, onlyErrorToast] = useResponseToast()

const redeemCode = ref('')

async function redeem() {
  const { code, msg } = await API.proxy.userRedeemProxyCodeCreate({ code: redeemCode.value })
  showToast(code, msg)
  if (code !== 0) return
  redeemCode.value = ''
}

</script>

<template>
  <div class="flex flex-col gap-1.5 select-none">
    <div class="title">{{ $t('兑换') }}</div>
    <div class="desc">{{ $t('在此兑换我们的服务或奖励') }}</div>
    <div class="flex gap-2.5">
      <TsFormInputText v-model="redeemCode" size="lg" :placeholder="$t('在此处粘贴兑换码')"></TsFormInputText>
      <RxButton severity="secondary" variant="outlined" size="lg" :label="$t('兑换')" @click="redeem" />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.title {
  color: var(--colors-text-text-primary);
  font-size: 16px;
  font-weight: 600;
  line-height: 20px;
}

.desc {
  color: var(--colors-text-text-secondary);
  font-size: 14px;
  line-height: 20px;
}
</style>
