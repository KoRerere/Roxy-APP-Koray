<script setup lang="ts">
import manage from '/@/views/browser/manage'

const products = ref(Array.from({ length: 10 }, (_, i) => ({
  id: i,
  code: 'f230fh0g3',
  name: 'Bamboo Watch',
  description: 'Product Description',
  image: 'bamboo-watch.jpg',
  price: 65,
  category: 'Accessories',
  quantity: 24,
  inventoryStatus: 'INSTOCK',
  rating: 5,
})))

const selectedProduct = ref({ id: 3 })
</script>

<template>
  <!-- <manage /> -->
  <DataTable v-model:selection="selectedProduct" :value="products" data-key="id" table-style="min-width: 50rem">
    <Column selection-mode="single" header-style="width: 3rem" />
    <Column field="code" header="Code" />
    <Column field="name" header="Name" />
    <Column field="category" header="Category" />
    <Column field="quantity" header="Quantity" />
  </DataTable>
</template>

<style scoped></style>
