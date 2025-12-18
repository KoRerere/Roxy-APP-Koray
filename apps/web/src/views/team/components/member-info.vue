<script setup lang="ts">
interface Props {
  userName: string
  avatarColor?: string
  avatar?: string
  hiddenAvatar?: boolean
  email?: string
  phone?: string
}

const {
  userName,
  avatarColor,
  avatar,
  hiddenAvatar = false,
  email,
  phone,
} = defineProps<Props>()
</script>

<template>
  <div class="flex items-center gap-3 min-w-70">
    <RxAvatar v-if="!hiddenAvatar" :avatar="avatar" :name="userName?.slice(0, 2)" :color="avatarColor" :class="{ 'no-avatar': !avatarColor }" :size="28" :font-size="14" />
    <div class="flex-1 flex flex-col items-start justify-center gap-0.5">
      <div class="ellipsis-1 email">
        {{ email || phone }}
      </div>
      <div class="ellipsis-1 name">
        {{ userName }}
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.no-avatar {
  border: 1px dashed var(--component-tag-border-hover);
  border-radius: 50%;
}

.email {
  color: var(--colors-text-text-primary);
  font-family: Inter;
  font-size: 13px;
  line-height: 16px;
  font-weight: 500;
}

.name {
  color: var(--colors-text-text-tertiary);
  font-family: 'JetBrains Mono';
  font-size: 12px;
  line-height: 16px;
  font-weight: 500;
}
</style>
