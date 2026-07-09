<script setup lang="ts">
interface Props {
  userName?: string
  nickName?: string
  avatarColor?: string
  avatar?: string
  email?: string
  phone?: string
  hiddenAvatar?: boolean
  onlyAvatar?: boolean
}

const { hiddenAvatar = false, onlyAvatar = false } = defineProps<Props>()
</script>

<template>
  <div class="flex items-center gap-3">
    <RxAvatar v-if="!hiddenAvatar" :tooltip="nickName || userName" :avatar="avatar" :name="userName" :color="avatarColor" :class="{ 'no-avatar': !avatarColor }" :size="28" :font-size="14" />
    <div v-if="!onlyAvatar" class="flex-1 flex flex-col items-start justify-center gap-0.5 min-w-50">
      <div class="ellipsis-1 tt-primary text-3.25 leading-4 font-500">
        {{ userName }}
      </div>
      <div class="ellipsis-1 font-[JetBrains_Mono] font-500 text-3 leading-4">
        {{ email || phone }}
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.no-avatar {
  border: 1px dashed var(--component-tag-border-hover);
  border-radius: 50%;
}
</style>
