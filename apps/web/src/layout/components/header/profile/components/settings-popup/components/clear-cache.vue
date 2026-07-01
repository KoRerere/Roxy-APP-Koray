<script setup lang="tsx">
import IconField from "primevue/iconfield";
import InputIcon from "primevue/inputicon";
import TsFormInputNumber from '/@/views/lab/components/form/m-input-number.vue'
import RxButton from "/@/components/rx-button";
import RxInputRadio from '/@/components/ry-form/rx-input-radio.vue'
import RxDivider from '/@/components/rx-divider.vue';
import { RxAlert } from '/@/components/rx-alert'
import { RxSvgIcon } from '/@/components/rx-icon';
import { useDialog } from '/@/hooks/useDialog'

import { useResponseToast } from '/@/hooks/useResponseToast'
import { ClearType } from "/@/enums";

const [showModal] = useDialog()
const [showToast] = useResponseToast()
const cssModule = useCssModule()

const days = ref(30)
const clearType = ref(ClearType.partial)
const options = [
  {
    label: $t('清除本地缓存（保留插件）'),
    value: ClearType.partial,
    afterRender: () => (
      clearType.value === ClearType.partial && (
        <RxAlert closable={false} class="!w-full" type="warn" title={$t('说明')}>
          {{
            content: () => (
              <div class="whitespace-pre-wrap">
                <i18n-t keypath={$t('清除扩展数据以外的所有本地缓存文件，{light}！窗口指纹信息、IP 不会被清理。', { light: '{light}' })} scope="global">
                  {{
                    light: () => <span class="text-orange-400">{$t('登录状态不会失效')}</span>,
                  }}
                </i18n-t>
              </div>
            ),
          }}
        </RxAlert>
      )
    ),
  },
  {
    label: $t('清除本地缓存'),
    value: ClearType.all,
    afterRender: () => (
      clearType.value === ClearType.all && (
        <RxAlert closable={false} class="!w-full" type="warn" title={$t('说明')}>
          {{
            content: () => (
              <div class="whitespace-pre-wrap">
                <i18n-t keypath={$t('清除所有本地缓存文件，{light}！窗口指纹信息、IP 不会被清理。', { light: '{light}' })} scope="global">
                  {{
                    light: () => <span class="text-orange-400">{$t('登录状态不会失效')}</span>,
                  }}
                </i18n-t>
              </div>
            ),
          }}
        </RxAlert>
      )
    ),
  },
]

function clearCache() {
  showModal({
    showHeader: false,
    modal: true,
    blockScroll: true,
    slots: {
      container: ({ hideModal }) => {
        return <div class="w-120 flex flex-col gap-4 pa-6 pt-4" >
          <div class="h-9 flex justify-between items-center" >
            <div>{$t('清除缓存数据')} </div>
            <div class="cursor-pointer" onClick={hideModal}>
              <RxSvgIcon size="20" name="base/rx_ic_delete" ></RxSvgIcon>
            </div>
          </div>
          <RxInputRadio class={cssModule.radio} v-model={clearType.value} name="clearType" options={options} />
          <RxDivider line-only></RxDivider>
          <i18n-t tag="div" class={`flex items-center gap-2.5 ${cssModule.text}`} keypath={$t('清除过去{input}未使用窗口的缓存数据', { input: '{input}' })} scope="global">
            {{
              input: () => <IconField class="w-18">
                <TsFormInputNumber size='sm' v-model={days.value} useGrouping={false} fluid min={0} />
                <InputIcon class="!pt-0.5 text-3 !right-1.5">{$t('天')}</InputIcon>
              </IconField>
            }}
          </i18n-t>
          <RxButton class="mt-1.5" size="md" label={$t('执行清除')} onClick={
            async () => {
              try {
                await globalThis.electronAPI.send('browser:clearCacheByTimestamp', { days: days.value, clearType: clearType.value as "partial" | "all" })
                showToast(0, $t('清除缓存数据成功'))
                hideModal()
              }
              catch {
                showToast(1, $t('操作失败'))
              }
            }
          }></RxButton>
        </div>
      },
    }
  })
}


</script>

<template>
  <RxButton severity="secondary" outlined :label="$t('选择清除选项')" @click="clearCache" />
</template>

<style lang="scss" module>
.text {
  color: var(--colors-text-text-secondary);
  font-size: 13px;
  line-height: 21px;
}

.radio {
  &:global(.rx-radio-group) {
    flex-direction: column;

    :global(.rx-radio-group-item) {
      padding-left: 0;
      border: none;
      min-width: auto;
      box-shadow: none;
      background: transparent;
    }

    :global(.p-radiobutton-checked+.rx-radio-group-item__text) {
      font-weight: 600;
    }
  }
}
</style>
