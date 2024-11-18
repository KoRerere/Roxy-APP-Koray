<script lang="ts" setup>
import { usePopoverMenu } from '/@/components/rx-popover-menu'

const [showMenu] = usePopoverMenu()

function opendropdown(event: Event) {
  showMenu(event, {
    model: [
      {
        label: '选项1',
        value: 'value1',
      },
      {
        label: '选项211111111111111111111111111111111111111111',
        value: 'value2',
      },
      {
        separator: true,
      },
      {
        label: '选项3',
        value: 'value3',
      },
    ],
  })
}
</script>

<template>
  <div class="w-50">
    <RxButton label="测试" @click="opendropdown" />
  </div>
</template>
