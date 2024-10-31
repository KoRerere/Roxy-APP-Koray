<script setup lang="ts">
import { RxAlert } from '/@/components/rx-alert'
import inputLabel from '/@/components/ry-form/input-label.vue'
import inputNumberGroup from '/@/components/ry-form/input-number-group.vue'
import RxInputSelect from '/@/components/ry-form/rx-input-select.vue'
import { getFormData, strConcat } from '/@/utils'
import { useCheckProxy } from '/@/views/agent/hooks'

const props = defineProps({
  inputs: {
    type: Array as PropType<any>,
    default: () => [],
  },
})

const [checkProxy, checkeResult] = useCheckProxy({ silence: true })

const visible = ref(false)

async function testProxy() {
  try {
    const data = getFormData(props.inputs)
    visible.value = false
    await checkProxy(toRaw(data))
    visible.value = true
  }
  catch (error) {
    console.log(error)
  }
}
</script>

<template>
  <RyForm :inputs="inputs">
    <template #server="{ input }">
      <div class="flex flex-col">
        <inputLabel :label="input.label" />
        <div class="flex">
          <div class="w-1/3">
            <RxInputSelect v-bind="input.items[0]" v-model="input.items[0].value" class="!border-r-0 !rounded-tr-none !rounded-br-none" />
          </div>
          <inputNumberGroup class="!rounded-tl-none !rounded-bl-none !shadow-none" :inputs="input.items" />
        </div>
      </div>
    </template>
    <template #ipchecker="{ input }">
      <div class="flex flex-col">
        <inputLabel :label="input.label" />
        <div class="flex gap-1.5">
          <div class="flex-1">
            <RxInputSelect v-bind="input.props" v-model="input.value" :name="input.name" />
          </div>
          <RxButton size="lg" outlined severity="secondary" :label="$t('测试代理')" icon="base/rx_ic_speed_test" @click="testProxy" />
        </div>
      </div>
    </template>
    <template #checkermessage>
      <RxAlert v-model:visible="visible" class="!w-full checkermessage" type="success" :title="$t('测试成功')" content="内容">
        <template #content>
          <i18n-t :keypath="$t('{location}{ip}', { location: '{location}', ip: '{ip}' })" scope="global">
            <template #location>
              <span>{{ $t('位置: {location}', { location: `${checkeResult.lastCountry}${strConcat('/', checkeResult.lastCity as string)}` }) }}</span>
            </template>
            <template #ip>
              <br><span>{{ $t('IP: {ip}', { ip: checkeResult.lastIp }) }}</span>
            </template>
          </i18n-t>
        </template>
      </RxAlert>
    </template>
  </RyForm>
</template>

<style lang="scss" scoped></style>
