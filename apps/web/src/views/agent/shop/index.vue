<script setup lang="ts">
import { format } from 'date-fns'
import { getFormData } from '/@/utils/index'
import ryForm from '/@/components/ry-form'

const inputs = ref([
  {
    type: 'date',
    items: [
      {
        placeholder: '开始时间',
        name: 'timeStart',
        value: null,
        formatValue: (self: any) => {
          return format(self.value, 'yyyy-MM-dd')
        },
      },
      {
        placeholder: '结束时间',
        name: 'timeEnd',
        value: null,
        formatValue: (self: any) => {
          return format(self.value, 'yyyy-MM-dd')
        },
      },
    ],
  },
])

const formData = ref()

function test() {
  formData.value = getFormData(inputs.value)
}
</script>

<template>
  <div class="box">
    <!-- <InputGroup>
      <template v-for="item in input.items" :key="item.name">
        <DatePicker v-model="item.value" :placeholder="item.placeholder" show-button-bar date-format="yy-mm-dd" />
      </template>
</InputGroup> -->
    <ryForm :inputs="inputs" />
  </div>
  <div @click="test">
    特效
  </div>
  {{ formData }}
</template>

<style lang="scss" scoped>
.box {
  width: 600px;
  height: 600px;
  background-color: pink;
}
</style>
