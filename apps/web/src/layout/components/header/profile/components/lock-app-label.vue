<script setup lang="ts">
const popRef = ref()

const classes = useCssModule('lockAppLabel')

function handleMouseEnter(event: Event) {
  popRef.value?.toggle(event)
}
</script>

<template>
  <div class="flex gap-2 items-center">
    {{ $t('应用上锁') }}
    <span class="cursor-pointer flex items-center text-[#AFB7BB]" @mouseenter="handleMouseEnter">
      <SvgIcon name="base/rx_ic_info" size="16" />
    </span>
  </div>
  <Popover ref="popRef" :class="classes.popover">
    <div class="flex flex-col gap-3">
      <span class="text-[12px]">{{ $t('启用应用程序锁定后，您可以在顶部栏中找到锁定图标按钮。') }}</span>
      <img src="/images/lock_instructions.png" class="min-h-[156px]" alt="应用上锁">
    </div>
  </Popover>
</template>

<style lang="scss" module="lockAppLabel">
.popover {
  border: 0.5px solid var(--Colors-border-border-base, #afb7bb) !important;
  box-shadow:
    0px 3px 8px 0px rgba(0, 0, 0, 0.07),
    0px 2px 5px 0px rgba(0, 0, 0, 0.07),
    0px 1px 1px 0px rgba(0, 0, 0, 0.07) !important;
  width: 264px;
}

.popover::before {
  visibility: hidden;
}

.popover::after {
  visibility: hidden;
}
</style>
