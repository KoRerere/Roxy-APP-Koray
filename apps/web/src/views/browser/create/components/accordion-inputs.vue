<script lang="ts" setup>
import inputLabel from '/@/components/ry-form/input-label.vue'
import RxInputSelect from '/@/components/ry-form/rx-input-select.vue'
import Position from '/@/views/browser/create/components/position.vue'
import AccountItem from './account.vue'
import ProxyItem from './proxy.vue'
import UrlsItem from './urls.vue'
import CookiesItem from './cookies.vue'
import Os from './os.vue'
import { $t } from '/@/locales/index.js'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { copyText } from '/@/utils/'
import type { Accordions } from './type.ts'

interface Props {
  accordions?: Accordions
  inputsGroup?: any[]
}

const { accordions, inputsGroup = [] } = defineProps<Props>()

const [showToast] = useResponseToast()

const settings = computed(() => {
  const [basic, ...others] = inputsGroup
  return {
    basic,
    others
  }
})

function onCopy(dirId: string) {
  copyText(dirId)
  showToast(0, $t('复制成功'))
}
</script>

<template>
  <div class="flex-ovh-1 flex-col">
    <div v-if="accordions" class="flex-1 overflow-auto content">
      <RyForm class="profile-info" v-if="settings.basic?.length" :inputs="settings.basic">
        <template #profileId="{ input }">
          <div class="flex items-center">
            <inputLabel v-bind="input" />
            <span class="dir-id">{{ input.value }}</span>
            <span class="text-3 color-blue-500 ml-2 cursor-pointer" @click="onCopy(input.value)">Copy</span>
          </div>
        </template>
        <template #system="{ input }">
          <div class="px-4">
            <inputLabel v-bind="input" />
            <div class="flex flex-col gap-2">
              <div class="flex gap-2">
                <InputGroup>
                  <Os v-bind="input.items[0]" v-model="input.items[0].value" @change="input.items[0].change?.(input.items[0], input.items)" />
                  <RxInputSelect v-bind="input.items[1]" v-model="input.items[1].value" @change="input.items[1].change?.(input.items[1], input.items)" />
                </InputGroup>
                <RxInputSelect v-bind="input.items[2]" v-model="input.items[2].value" @change="input.items[2].change?.(input.items[2], input.items)" />
              </div>
              <Message v-if="input.items[2].help" severity="error" size="small" variant="simple">{{ input.items[2].help }}</Message>
            </div>
          </div>
        </template>
        <template #proxy="{ input }">
          <div class="-mt-4 px-4 py-6 w-full dashed-border">
            <ProxyItem v-model="input.value" v-bind="input" />
          </div>
        </template>
        <template #accounts="{ input }">
          <div class="-mt-4 px-4 py-6 w-full dashed-border">
            <AccountItem v-model="input.value" v-model:type="input.platformBindType" v-bind="input" />
          </div>
        </template>
        <template #urls="{ input }">
          <UrlsItem class="-mt-4" v-model="input.value" v-model:invalid="input.invalid" v-bind="input" />
        </template>
        <template #cookies="{ input }">
          <CookiesItem class="-mt-4" v-model="input.value" v-model:invalid="input.invalid" v-bind="input" />
        </template>
      </RyForm>
      <RxAccordion :value="accordions.value" multiple>
        <AccordionPanel v-for="(panels, index) in accordions.panels" :key="panels.title" :value="panels.value" :pt="{ root: 'border-dashed' }">
          <AccordionHeader as="div" #default="{ active }">
            <div class="flex items-center gap-3 header">
              <SvgIcon class="header-icon" :name="active ? 'base/rx_ic_minus' : 'base/rx_ic_plus'" size="20"></SvgIcon>
              <span>{{ panels.title }}</span>
            </div>
          </AccordionHeader>
          <AccordionContent>
            <RyForm :inputs="settings.others[index]" label-position="left">
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
      </RxAccordion>
    </div>
  </div>
</template>

<style lang="scss" scoped>
:deep(.p-inputgroup) {

  .p-select+.p-select,
  .p-inputtext+.p-inputtext {
    border-left: none;
  }
}

:deep(.rx-label) {
  max-width: 120px;
}

.content {
  padding: 0 36px 40px 64px;

  &::-webkit-scrollbar {
    display: none;
  }
}

.profile-info {
  :deep(.separator) {
    border-style: dashed;
  }

  :deep(.rx-input) {
    padding-left: 1rem;
    padding-right: 1rem;
  }
}

.dashed-border {
  border-bottom: 1px dashed var(--colors-border-divider-dashed);
}

.dir-id {
  font-size: 12px;
  font-family: 'JetBrains Mono';
}

.header {
  color: var(--colors-text-text-primary);
  font-size: 16px;
  font-weight: 600;
  line-height: 16px;

  &-icon {
    border: 1px solid var(--colors-border-border-base);
    border-radius: 4px;
    padding: 2px;
    background: var(--colors-background-bg-action);
  }
}

.tip-text {
  color: var(--colors-text-text-tertiary, #575D60);
  font-size: 12px;
  line-height: 16px;
}
</style>
