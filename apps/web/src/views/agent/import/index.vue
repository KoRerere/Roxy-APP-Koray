<script setup lang="ts">
import { useContextMenu } from '/@/components/rx-ctxmenu'

const [show, hide] = useContextMenu()

const operation = [
  {
    name: 'edit',
    label: '编辑',
    icon: 'mdi mdi-pencil-outline',
  },
  {
    separator: true,
  },
  {
    name: 'view',
    label: '预览',
    icon: 'mdi mdi mdi-cube-scan',
  },
  {
    name: 'restart',
    label: '重启',
    icon: 'mdi mdi-restart',
  },
  {
    name: 'close',
    label: '关闭',
    icon: 'mdi mdi-power',
  },
]

function operationHandler(item: any, data: any) {
  console.log(item)
  console.log(data)
}

function test(event: Event, data: any) {
  show(event, {
    operation,
    operationHandler: (item: any) => operationHandler(item, data),
  })
}
</script>

<template>
  <Button label="Import Agent" @click="(event) => test(event, 'man!')" />
  <br>
  <br>
  <br>
  <br>
  <Button label="hide" @click="hide" />
</template>

<style scoped></style>
