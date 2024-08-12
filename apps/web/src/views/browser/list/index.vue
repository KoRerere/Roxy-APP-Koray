<script setup lang="ts">
import rbTable from '/@/components/rb-table';

interface User {
  valueKey: string
  name: string
  address: string
}

const list: User[] = [
  {
    valueKey: '2016-05-04',
    name: 'Aleyna Kutzner',
    address: 'Lohrbergstr. 86c, Süd Lilli, Saarland',
  },
  {
    valueKey: '2016-05-03',
    name: 'Helen Jacobi',
    address: '760 A Street, South Frankfield, Illinois',
  },
  {
    valueKey: '2016-05-02',
    name: 'Brandon Deckert',
    address: 'Arnold-Ohletz-Str. 41a, Alt Malinascheid, Thüringen',
  },
  {
    valueKey: '2016-05-01',
    name: 'Margie Smith',
    address: '23618 Windsor Drive, West Ricardoview, Idaho',
  }
]

const columns = {
  version: 0.1,
  name: 'browser',
  data: [
    {
      label: '样式覆盖',
      key: 'address',
      className: 'scvr-class',
      labelClassName: 'label-class-name',
      minWidth: 240,
    },
    {
      label: '插槽',
      key: 'name',
      slot: 'scvr',
    },
    {
      label: '多字段修改拼接',
      key: ' valueKey',
      minWidth: 150,
      getText: (data: any) => `${data.valueKey.replace(/-/g, '/')} && ${data.name}`
    },
    {
      label: '操作项',
      width: 150,
      slot: 'operations',
    }
  ]
}


</script>

<template>
  <div>
    <rb-table :list="list" :columns="columns">
      <template #scvr="{ data }">
        <span style="color:orangered">{{ `${data.valueKey} ` }}</span>
      </template>
      <template #operations>
        <el-button link type="primary" size="small">Detail</el-button>
        <el-button link type="primary" size="small">Edit</el-button>
      </template>
    </rb-table>
  </div>
</template>



<style scoped>
:deep(.scvr-class) {
  color: red;
}

:deep(.label-class-name) {
  color: green;
}
</style>