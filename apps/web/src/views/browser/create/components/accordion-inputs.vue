<script lang="ts" setup>
import { RxSvgIcon } from '/@/components/rx-icon/'
import inputLabel from '/@/components/ry-form/input-label.vue'
import RxInputSelect from '/@/components/ry-form/rx-input-select.vue'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { $t } from '/@/locales/index.js'
import { copyText } from '/@/utils/'
import accountItem from './account.vue'
import proxyItem from './proxy.vue'
import urlsItem from './urls.vue'
import Position from '/@/views/browser/create/components/position.vue'
import Os from './os.vue'
import type { Accordions } from './type.ts'

defineProps({
  accordions: {
    type: Object as PropType<Accordions>,
    default: undefined,
  },
  inputsGroup: {
    type: Array as PropType<any[]>,
    default: () => [],
  },
  windowInfo: {
    type: Object as PropType<any>,
    default: () => ({}),
  }
})

const [showToast] = useResponseToast()

function onCopy(dirId: string) {
  copyText(dirId)
  showToast(0, $t('复制成功'))
}
</script>

<template>
  <div class="flex-ovh-1 flex-col">
    <div v-if="accordions" class="flex-1 overflow-auto content">
      <Accordion :value="accordions.value" multiple :pt="{ root: 'flex flex-col gap-4' }">
        <template #collapseicon>
          <RxSvgIcon name="base/rx_ic_chevron_down" />
        </template>
        <template #expandicon>
          <RxSvgIcon name="base/rx_ic_chevron_up" />
        </template>
        <AccordionPanel v-for="(panels, index) in accordions.panels" :key="panels.title" :value="panels.value" :pt="{ root: '!border-none' }">
          <AccordionHeader as="div" class="accordion-header">
            {{ panels.title }}
          </AccordionHeader>
          <AccordionContent :pt="{ content: '!py-4 !px-2' }">
            <RyForm :inputs="inputsGroup[index]" label-position="left">
              <template #profileId="{ input }">
                <div class="flex leading-[32px]">
                  <inputLabel v-bind="input" />
                  <span class="dir-id">{{ input.value }}</span>
                  <span class="text-3 color-blue-500 ml-2 cursor-pointer" @click="onCopy(input.value)">Copy</span>
                </div>
              </template>
              <template #system="{ input }">
                <div class="flex">
                  <inputLabel v-bind="input" />
                  <div class="flex-1 flex flex-col gap-2">
                    <div class="flex-1 flex gap-2">
                      <InputGroup>
                        <Os v-bind="input.items[0]" v-model="input.items[0].value" @change="input.items[0].change?.(input.items[0], input.items)" />
                        <RxInputSelect v-bind="input.items[1]" v-model="input.items[1].value" @change="input.items[1].change?.(input.items[1], input.items)" />
                      </InputGroup>
                      <RxInputSelect v-bind="input.items[2]" v-model="input.items[2].value" @change="input.items[2].change?.(input.items[2], input.items)" />
                    </div>
                    <Message v-if="input.items[2].help" severity="error" size="small" variant="simple">
                      {{ input.items[2].help }}
                    </Message>
                  </div>
                </div>
              </template>
              <template #searchEngine="{ input }">
                <div class="flex">
                  <inputLabel v-bind="input" />
                  <div class="flex-1 flex gap-2">
                    <div class="flex-1">
                      <RxInputSelect v-bind="input" v-model="input.value" @change="input.change?.(input, input.items)" />
                    </div>
                    <div class="flex-1"></div>
                  </div>
                </div>
              </template>
              <template #proxy="{ input }">
                <div class="flex">
                  <inputLabel v-bind="input" />
                  <proxyItem v-model:proxy-switch="input.switch" :windowInfo v-model="input.value" class="flex-1" />
                </div>
              </template>
              <template #accounts="{ input }">
                <div class="flex">
                  <inputLabel v-bind="input" />
                  <accountItem v-model="input.value" class="flex-1" />
                </div>
              </template>
              <template #urls="{ input }">
                <div class="flex">
                  <inputLabel v-bind="input" />
                  <urlsItem v-model="input.value" v-model:invalid="input.invalid" v-bind="input" />
                </div>
              </template>
              <template #windowOpenSize="{ input }">
                <div class="flex">
                  <inputLabel v-bind="input" />
                  <div class="flex gap-[8px]">
                    <InputGroup v-for="(item, index) in input.items" :key="item.name">
                      <InputGroupAddon>{{ index === 0 ? $t('宽') : $t('高') }}</InputGroupAddon>
                      <InputText v-bind="item" v-model="item.value" type="text" />
                    </InputGroup>
                  </div>
                </div>
              </template>
              <template #windowRatioPosition="{ input }">
                <div class="flex py-4">
                  <inputLabel v-bind="input" />
                  <Position v-model="input.value" />
                </div>
              </template>
              <template #forbiddenPictureSize="{ input }">
                <div class="flex">
                  <inputLabel v-bind="input" />
                  <div>
                    <div class="tip-text">
                      {{ $t('禁止加载超过以下大小的图片（如果设置为0则不加载任何图片，为避免无法显示验证码，建议填写10KB）') }}
                    </div>
                    <div class="w-[105px] mt-2">
                      <IconField>
                        <InputNumber v-model="input.value" inputClass="w-full !pr-[28px]" size="small" />
                        <InputIcon class="tip-text">KB</InputIcon>
                      </IconField>
                    </div>
                  </div>
                </div>
              </template>
            </RyForm>
          </AccordionContent>
        </AccordionPanel>
      </Accordion>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.dir-id {
  font-size: 12px;
  font-family: 'JetBrains Mono';
}

.content {
  padding: 0 36px 40px 64px;

  &::-webkit-scrollbar {
    display: none;
  }
}

:deep(.p-accordionheader) {
  padding: 6px 8px;
  border-radius: 4px;
  font-family: Inter;
  font-size: 12px;
  font-weight: 600;
  line-height: 16px;
}

:deep(.p-inputgroup) {

  .p-select+.p-select,
  .p-inputtext+.p-inputtext {
    border-left: none;
  }
}

:deep(.rx-label) {
  max-width: 120px;
}

.tip-text {
  color: var(--colors-text-text-tertiary, #575D60);
  font-family: Inter;
  font-size: 12px;
  line-height: 16px;
}
</style>
