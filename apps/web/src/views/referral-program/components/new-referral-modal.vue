<script setup lang="ts">
import { useSimpleLocale } from '/@/stores/locale'
import { getImage } from '/@/utils'

defineEmits(['close'])

const { currentLocale } = storeToRefs(useSimpleLocale())

const infos = [
  $t('🔗 推广链接更简洁'),
  $t('全新格式： /invite/xxx，简洁美观，推广更友好。'),
  $t('旧版兼容： 原 ?code=xxxx 链接依然生效，相关奖励与历史数据已完美整合，无需更换。'),
]

const infos2 = [
  $t('🔑 新增「邀请码」功能'),
  $t('现已支持直接复制 专属短码。新用户注册时手动填写，即可轻松绑定推荐关系，分享更灵活。'),
]

const imageSrc = computed(() => {
  const suffix = ['zh-CN', 'en', 'ru'].includes(currentLocale.value!) ? currentLocale.value : 'zh-CN'
  return getImage(`referral-program/referral_img_${suffix}.jpg`)
})
</script>

<template>
  <div class="flex flex-col pa-6 pt-4 gap-4 popup">
    <div class="flex justify-between items-center">
      <span class="tt-primary text-4 font-600 leading-normal">{{ $t('推广计划全新升级') }}</span>
      <SvgIcon class="cursor-pointer" name="base/rx_ic_delete" size="20" color="var(--colors-icon-icon-note)" @click="$emit('close')" />
    </div>
    <img class="block w-full rounded-md" :src="imageSrc">
    <div>
      <div v-for="text in infos" :key="text" class="tt-secondary text-3.25 leading-5">
        {{ text }}
      </div>
      <br>
      <div v-for="text in infos2" :key="text" class="tt-secondary text-3.25 leading-5">
        {{ text }}
      </div>
    </div>
    <RxButton class="self-end" size="md" :label="$t('了解')" @click="$emit('close')" />
  </div>
</template>

<style lang="scss" scoped>
.popup {
  width: 560px;
}
</style>
