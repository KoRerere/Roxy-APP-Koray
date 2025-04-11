<script setup lang="ts">
import { $t } from '/@/locales';

const emit = defineEmits(['close'])

const videoPlayer = useTemplateRef('video')

function togglePlay() {
  if (videoPlayer.value!.paused) {
    videoPlayer.value!.play()
  } else {
    videoPlayer.value!.pause()
  }
}
</script>

<template>
  <div class="flex flex-col pa-6 pt-4 gap-6 popup">
    <div class="flex justify-between items-center">
      <span class="header">{{ $t('如何获取空间 ID') }}</span>
      <SvgIcon class="cursor-pointer" name="base/rx_ic_delete" size="20" color="#575D60" @click="$emit('close')" />
    </div>
    <div class="description">{{ $t('RoxyBrowser 允许您在不同的工作空间之间转移窗口：') }}</div>
    <ol class="flex flex-col gap-1 ma-0 pa-0 pl-5">
      <li class="description">{{ $t('您可以直接将窗口转移到您拥有的其他工作空间。') }}</li>
      <li class="description">{{ $t('要转移到其他人的工作空间，您需要他们的工作空间 ID。这可以通过在 Workspace 管理模式中点击设置按钮来复制。') }}</li>
    </ol>
    <video ref="video" class="block w-full rounded-md cursor-pointer" autoplay muted loop playsinline @click="togglePlay">
      <source src="/video/copy_workspace_id.mp4" type="video/webm" />
    </video>
    <RxButton class="self-end" @click="$emit('close')" size="md" :label="$t('我明白了')" />
  </div>
</template>

<style lang="scss" scoped>
.popup {
  width: 560px;
}

.header {
  color: var(--Colors-text-text-primary, #111213);
  font-size: 16px;
  font-weight: 600;
  line-height: normal;
}

.description {
  color: var(--Colors-text-text-primary, #111213);
  font-size: 14px;
  line-height: 22.4px;
}
</style>