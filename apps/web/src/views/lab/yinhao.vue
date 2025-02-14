<script setup lang="tsx">
import { $t } from '/@/locales';

const columns = ref([
  {
    key: 'code',
    title: $t('代理类型'),
    style: {
      width: '50%',
      minWidth: '400px'
    }
  },
  {
    key: 'name',
    title: $t('主机'),
    style: {
      width: '20%',
      minWidth: '200px'
    }
  },
  {
    key: 'category',
    title: $t('端口'),
    style: {
      width: '20%',
      minWidth: '200px'
    }
  },
  {
    key: 'quantity',
    title: $t('用户名'),
    style: {
      width: '10%',
      minWidth: '200px'
    }
  }
])

const dataList = Array.from({ length: 10 }, (_, i) => ({
  code: `code${i}`,
  name: `name${i}`,
  category: `category${i}`,
  quantity: `quantity${i}`,
}))
</script>

<template>
  <div class="flex justify-end gap-5">
    <RyTable :columns="columns" :data-list="dataList" :paginator="false" :show-table-header="false" :show-actions="false">
    </RyTable>
  </div>
</template>
