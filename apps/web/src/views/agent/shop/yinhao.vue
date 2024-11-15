<script setup>
import { RxSvgIcon } from '/@/components/rx-icon/'
import RxInputSelect from '/@/components/ry-form/rx-input-select.vue'

const profileTemplate = reactive({
  list: [],
  value: '1',
  props: {
    options: [
      { label: 'template1', value: '1' },
      { label: 'template2', value: '2' },
      { label: 'template3', value: '3' },
      { label: 'template4', value: '4' },
    ],
    optionValue: 'value',
    filter: false,
  },
})

async function test () {
  const dd = await electronAPI.send('util:callRandomFingerprintFunc', {
    // genRandomFonts: [],
    // getCanvasContextNoiseValue: [],
    // getRandomInt: [200, 500],
    // getSpeechSynthesis: [],
    // getClientRectsValue: [],
    getwebGLNoiseValue: [],
  })

  console.log(dd)
}
</script>

<template>
  <div class="w-50">
    <RxInputSelect v-model="profileTemplate.value" v-bind="profileTemplate.props" name="template">
      <template #option-extra>
        <div class="flex flex-1 justify-end gap-2">
          <RxSvgIcon name="base/rx_ic_edit" @click.stop />
          <RxSvgIcon name="base/rx_ic_bin_1" @click.stop />
        </div>
      </template>
    </RxInputSelect>
    <RxButton label="测试" @click="test" />
  </div>
</template>
