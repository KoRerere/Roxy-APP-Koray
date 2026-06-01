<script lang="ts" setup>
import InputLabel from '/@/components/ry-form/input-label.vue'
import RxInputSelect from '/@/components/ry-form/rx-input-select.vue'
import RxInputText from '/@/components/ry-form/rx-input-text.vue'
import Position from '/@/views/browser/create/components/position.vue'
import AccountItem from './account.vue'
import UserAgentField from './user-agent-field.vue'
import ProxyItem from './proxy.vue'
import UrlsItem from './urls.vue'
import CookiesItem from './cookies.vue'
import OsSwitch from './os-switch.vue'
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
    others,
  }
})

function onCopy(dirId: string) {
  copyText(dirId)
  showToast(0, $t('复制成功'))
}
</script>

<template>
  <div class="flex-ovh-1 min-w-0 w-full flex-col">
    <div v-if="accordions" class="content min-w-0 flex-1 overflow-auto pb-4">
      <slot name="before" />
      <RyForm v-if="settings.basic?.length" class="profile-info min-w-0 w-full max-w-full" label-position="left" :inputs="settings.basic">
        <template #name="{ input }">
          <div class="flex flex-col gap-2 px-4">
            <div v-if="!!input.dirId" class="flex items-center justify-end gap-2.5">
              <span class="text-3 font-[JetBrains_Mono]">ID:{{ input.dirId }}</span>
              <span class="text-3 font-[JetBrains_Mono] color-blue cursor-pointer" @click="onCopy(input.dirId)">{{ $t('复制') }}</span>
            </div>
            <div class="flex items-center">
              <InputLabel v-bind="input" />
              <RxInputText v-model="input.value" v-bind="input" />
            </div>
          </div>
        </template>
        <template #system="{ input }">
          <div class="flex items-center px-4">
            <InputLabel v-bind="input" />
            <div class="flex-1 flex gap-2 overflow-hidden">
              <OsSwitch v-model="input.items[0].value" class="flex-1" :options="input.items[0].options" @change="input.items[0].change?.(input.items[0], input.items)">
                <template #item="{ item }">
                  <SvgIcon :name="item.icon!" />
                </template>
              </OsSwitch>
              <RxInputSelect v-bind="input.items[1]" v-model="input.items[1].value" class="flex-1" @change="input.items[1].change?.(input.items[1], input.items)" />
            </div>
          </div>
        </template>
        <template #kernel="{ input }">
          <div class="flex items-center px-4">
            <InputLabel v-bind="input" />
            <div class="flex-1 flex flex-col gap-2 overflow-hidden">
              <div class="flex-1 flex gap-2 overflow-hidden">
                <OsSwitch v-model="input.items[0].value" class="flex-1" :disabled="input.items[0].disabled" :options="input.items[0].options"
                          @change="input.items[0].change?.(input.items[0], input.items)"
                >
                  <template #item="{ item }">
                    <div class="flex items-center gap-1.5">
                      <SvgIcon :name="item.icon!" />
                      <span>{{ item.label }}</span>
                    </div>
                  </template>
                </OsSwitch>
                <RxInputSelect v-bind="input.items[1]" v-model="input.items[1].value" class="flex-1" @change="input.items[1].change?.(input.items[1], input.items)" />
              </div>
              <Message v-if="input.items[1].help" severity="error" size="small" variant="simple">
                {{ input.items[1].help }}
              </Message>
            </div>
          </div>
        </template>
        <template #userAgent="{ input }">
          <UserAgentField :input="input" :inputs-group="inputsGroup" />
        </template>
        <template #cookies="{ input }">
          <CookiesItem v-model="input.value" v-model:invalid="input.invalid" v-bind="input" />
        </template>
        <template #proxy="{ input }">
          <div class="-mt-5 px-4 py-6 w-full dashed-border">
            <ProxyItem v-model="input.value" v-bind="input" />
          </div>
        </template>
        <template #accounts="{ input }">
          <div class="-mt-5 px-4 py-6 w-full dashed-border">
            <AccountItem v-model="input.value" v-model:type="input.platformBindType" v-bind="input" />
          </div>
        </template>
        <template #urls="{ input }">
          <UrlsItem v-model="input.value" v-model:invalid="input.invalid" class="-mt-5" v-bind="input" />
        </template>
      </RyForm>
      <RxAccordion :value="accordions.value" multiple>
        <AccordionPanel v-for="(panels, index) in accordions.panels" :key="panels.title" :value="panels.value" :pt="{ root: '!border-dashed' }">
          <AccordionHeader v-slot="{ active }" as="div">
            <div class="flex items-center gap-3 header">
              <SvgIcon class="header-icon" :name="active ? 'base/rx_ic_minus' : 'base/rx_ic_plus'" size="20" />
              <span>{{ panels.title }}</span>
            </div>
          </AccordionHeader>
          <AccordionContent>
            <RyForm :inputs="settings.others[index]" label-position="left">
              <template #windowOpenSize="{ input }">
                <div class="flex">
                  <InputLabel v-bind="input" />
                  <div class="flex gap-2">
                    <InputGroup v-for="(item, idx) in input.items" :key="item.name">
                      <InputGroupAddon class="text-3.5">
                        {{ idx === 0 ? $t('宽') : $t('高') }}
                      </InputGroupAddon>
                      <RxInputText v-bind="item" v-model="item.value" class="!w-25" />
                    </InputGroup>
                  </div>
                </div>
              </template>
              <template #windowRatioPosition="{ input }">
                <div class="flex py-4">
                  <InputLabel v-bind="input" />
                  <Position v-model="input.value" />
                </div>
              </template>
              <template #forbiddenPictureSize="{ input }">
                <div class="flex">
                  <InputLabel v-bind="input" />
                  <div>
                    <div class="tip-text">
                      {{ $t('禁止加载超过以下大小的图片（如果设置为0则不加载任何图片，为避免无法显示验证码，建议填写10KB）') }}
                    </div>
                    <div class="w-[105px] mt-2">
                      <IconField>
                        <InputNumber v-model="input.value" input-class="w-full !pr-[28px]" size="small" />
                        <InputIcon class="tip-text">
                          KB
                        </InputIcon>
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
:deep(.p-accordionheader) {
  padding: 24px 16px;
}

:deep(.p-inputgroup) {
  .p-select + .p-select,
  .p-inputtext + .p-inputtext {
    border-left: none;
  }
}

:deep(.rx-label) {
  text-align: right;
  max-width: 100px;
  min-width: 100px !important;
}

.content {
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

  :deep(.rx-label) {
    text-align: right;
    min-width: 100px !important;
  }
}

.dashed-border {
  border-bottom: 1px dashed var(--colors-border-divider-dashed);
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
  color: var(--colors-text-text-tertiary, #575d60);
  font-size: 12px;
  line-height: 16px;
}
</style>
