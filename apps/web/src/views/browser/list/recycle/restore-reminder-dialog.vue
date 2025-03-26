<script setup lang="ts">
const { onConfirm } = defineProps<{
  onConfirm: (isRemind: boolean) => void
}>()

// 不再提醒
const cid = useId()
const isRemind = ref(false)

function handleConfirm() {
  onConfirm(isRemind.value)
}
</script>

<template>
  <div class="restore-reminder-dialog">
    <div class="description">
      {{ $t('恢复所选窗口会占用您的窗口用量') }}
    </div>
    <div class="description mt-[20px]">
      {{ $t('* 请注意，恢复的操作时间将覆盖原窗口的创建时间') }}
    </div>
    <div class="mt-[20px] flex justify-between">
      <div class="flex items-center gap-2">
        <Checkbox v-model="isRemind" :input-id="cid" name="pizza" value="Cheese" />
        <label :for="cid"> {{ $t('不再提醒') }} </label>
      </div>
      <RxButton @click="handleConfirm">
        {{ $t('确认') }}
      </RxButton>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.description {
  color: var(--Colors-Text-text-primary, #171c1f);
  font-size: 14px;
  font-style: normal;
  font-weight: 400;
  line-height: 25.6px;
}
</style>
