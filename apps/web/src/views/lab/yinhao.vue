<script lang="ts" setup>
const customers = ref(Array.from({ length: 100 }).map((_, i) => ({
  id: i,
  name: 'James Butt',
  country: {
    name: 'Algeria',
    code: 'dz',
  },
  company: 'Benton, John B Jr',
  date: '2015-09-13',
  status: 'unqualified',
  verified: true,
  activity: 17,
  representative: {
    name: 'Ioni Bowcher',
    image: 'ionibowcher.png',
  },
  balance: 70663,
})))
</script>

<template>
  <div class="h-100">
    <DataTable :value="customers" resizable-columns column-resize-mode="expand" scrollable scroll-height="flex">
      <Column field="id" header="Id" />
      <Column field="name" header="Name" />
      <Column field="country.name" header="Country" />
      <Column field="date" header="Date" />
      <!-- <Column field="company" header="Company" footer="Company" /> -->
      <!-- <Column field="status" header="Status" footer="Status" /> -->
      <!-- <Column field="activity" header="Activity" footer="Activity" /> -->
      <Column field="representative.name" header="Representative" />
    </DataTable>
  </div>
</template>
