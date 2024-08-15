<script setup>
import scTable from '/@/components/sc-table'
// import { ProductService } from '@/service/ProductService'

onMounted(() => {
  // ProductService.getProductsMini().then((data) => (products.value = data));
})

const columns = [
  {
    title: '平台',
    key: 'platform',
  },
  {
    title: '账号名称',
    key: 'accountName',
  },
  {
    title: '相关简介',
    key: 'relatedProfiles',
  },
  {
    title: '动作',
    key: 'actions',
  },
]

const dataList = ref([
  {
    id: 0,
    platform: 'mac',
    accountName: 'mac账号',
    relatedProfiles: 'aaaaaaaaaaa',
  },
  {
    id: 1,
    platform: 'mac',
    accountName: 'mac账号',
    relatedProfiles: 'aaaaaaaaaaa',
  },
  {
    id: 2,
    platform: 'mac',
    accountName: 'mac账号',
    relatedProfiles: 'aaaaaaaaaaa',
  },
  {
    id: 3,
    platform: 'mac',
    accountName: 'mac账号',
    relatedProfiles: 'aaaaaaaaaaa',
  },
  {
    id: 4,
    platform: 'mac',
    accountName: 'mac账号',
    relatedProfiles: 'aaaaaaaaaaa',
  },
])
</script>

<template>
  <div class="card">
    <sc-table :data-list="dataList" :columns="columns" />
  </div>
</template>
