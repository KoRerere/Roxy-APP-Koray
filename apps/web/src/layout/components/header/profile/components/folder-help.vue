<script setup lang="ts">
;

defineEmits(['close', 'confirm'])

const isAgree = ref(false)
</script>

<template>
  <div class="flex flex-col pa-6 pt-4 gap-6 popup">
    <div class="flex justify-between items-center">
      <span class="header">{{ $t('迁移当前缓存文件') }}</span>
      <SvgIcon class="cursor-pointer" name="base/rx_ic_delete" size="20" color="var(--colors-icon-icon-note)" @click="$emit('close')" />
    </div>
    <div class="flex flex-col gap-3">
      <div class="description">{{ $t('修改缓存路径后，现有窗口启动时将从新路径尝试读取缓存。') }}</div>
      <i18n-t class="description" tag="div" :keypath="$t('为了避免您现有窗口的缓存丢失，{bold}将旧路径下的所有缓存文件手动迁移至新的缓存路径下。 ', { bold: '{bold}' })" scope="global">
        <template #bold>
          <span class="font-bold">{{ $t('在修改缓存路径后，请您务必于再次启动窗口前') }}</span>
        </template>
      </i18n-t>
    </div>

    <!-- <ol class="flex flex-col gap-1 ma-0 pa-0 pl-5">
      <li class="description">{{ $t('为了避免您已有窗口的本地缓存丢失，您需要确保在修改缓存路径后，优先将之前已有的所有缓存文件手动迁移至新的缓存路径下。') }}</li>
      <li class="description">{{ $t('要转移窗口至其他人的工作空间，您需得知相应的空间 ID') }}</li>
    </ol> -->
    <!-- <div class="description">{{ $t('您可以通过以下操作指引获取空间 ID') }}</div> -->
    <!-- <video class="block w-full rounded-md" autoplay muted loop playsinline>
      <source src="/video/copy_workspace_id.mp4" type="video/webm" />
    </video> -->
    <div class="flex items-center gap-2.5">
      <RxCheckbox v-model="isAgree" input-id="wrap" binary />
      <label for="wrap" class="tip">{{ $t('我已知晓应迁移旧缓存文件至新路径以避免现有窗口数据无法读取。') }}</label>
    </div>

    <div class="flex justify-end items-center gap-2.5">
      <RxButton severity="danger" :disabled="!isAgree" size="md" :label="$t('打开当前缓存路径 & 选择新路径')" @click="$emit('confirm')" />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.popup {
  width: 540px;
}

.header {
  color: var(--colors-text-text-primary);
  font-size: 16px;
  font-weight: 600;
  line-height: normal;
}

.description {
  color: var(--colors-text-text-primary);
  font-size: 14px;
  line-height: 22.4px;
}

.tip {
  color: var(--colors-text-text-primary);
  font-size: 14px;
  line-height: 20px;
}
</style>
