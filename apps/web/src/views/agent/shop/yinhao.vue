<script setup>
import useColumns from '/@/hooks/useColumns'
import { sleep } from '/@/utils'

const [columns] = useColumns({
  key: 'scvr.man',
  data: [
    {
      title: 'Id',
      key: 'id',
    },
    {
      title: 'Vin',
      key: 'vin',
    },
    {
      title: 'Brand',
      key: 'brand',
    },
    {
      title: 'Color',
      key: 'color',
    },
    {
      title: 'Year',
      key: 'year',
    },
  ],
})

function tableRequest () {
  return sleep(1000).then(() => {
    return {
      data: {
        rows: Array.from({ length: 100000 }).map((_, i) => ({
          id: i + 1,
          vin: 'tvACo',
          brand: 'Norma',
          color: 'Black',
          year: 2002,
        })),
      },
    }
  })
}
</script>

<template>
  <RyTable :columns="columns" :table-request="tableRequest" :virtual-scroller-options="{ itemSize: 60 }" :show-actions="false" />
</template>
