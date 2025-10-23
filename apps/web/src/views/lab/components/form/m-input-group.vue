<script setup lang="ts"></script>

<template>
  <div class="flex items-start" :class="group.content">
    <slot />
  </div>
</template>

<style lang="scss" module="group">
.content>* {
  &:not(:first-child):not(:last-child) {

    :global(.p-inputtext),
    :global(.p-select) {
      border-radius: 0;
      box-shadow: none;
    }
  }

  &:first-child {

    :global(.p-inputtext),
    :global(.p-select) {
      border-top-right-radius: 0;
      border-bottom-right-radius: 0;
      border-right-width: 0;
    }
  }

  &:last-child {

    :global(.p-inputtext),
    :global(.p-select) {
      border-top-left-radius: 0;
      border-bottom-left-radius: 0;
      border-left-width: 0;
    }
  }
}
</style>
