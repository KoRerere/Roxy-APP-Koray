<script setup lang="tsx">
import { RxAlert } from '/@/components/rx-alert'
import RxInputRadio from '/@/components/ry-form/rx-input-radio.vue'
import { ClearType } from '/@/enums'
import { $t } from '/@/locales'
import { useRoleStore } from '/@/stores/role'

const role = useRoleStore()
const dialogRef = inject<any>('dialogRef')
const _props = ref()
const _onConfirm = ref()
const _onCancel = ref()
const value = ref(ClearType.partial)

const options = [
  {
    label: $t('清除本地缓存（保留插件）'),
    value: ClearType.partial,
    afterRender: () => (
      value.value === ClearType.partial && (
        <RxAlert closable={false} class="!w-full" type="warn" title={$t('说明')}>
          {{
            content: () => (
              <div class="whitespace-pre-wrap">
                <i18n-t keypath={$t('1.清除本电脑上除了窗口扩展及扩展数据外的所有缓存文件，{light}！环境的参数、IP不会被清理。\n2.常用于解决未知原因的环境打开异常或缓慢等问题。', { light: '{light}' })} scope="global">
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
      value.value === ClearType.all && (
        <RxAlert closable={false} class="!w-full" type="warn" title={$t('说明')}>
          {{
            content: () => (
              <div class="whitespace-pre-wrap">
                <i18n-t keypath={$t('1.清除本电脑上的所有缓存文件，{light}！环境的参数、IP不会被清理。\n2.常用于解决未知原因的环境打开异常或缓慢等问题。', { light: '{light}' })} scope="global">
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
    label: $t('清除云端缓存'),
    value: ClearType.cloud,
    visible: role.isOwner || role.isManager,
    afterRender: () => (
      value.value === ClearType.cloud && (
        <RxAlert closable={false} class="!w-full" type="warn" title={$t('说明')}>
          {{
            content: () => (
              <div class="whitespace-pre-wrap">
                <i18n-t keypath={$t('1.清除本电脑及云端的Cookie和全部缓存。{light}。\n2.常用于解决未知原因的环境打开异常或缓慢等问题。', { light: '{light}' })} scope="global">
                  {{
                    light: () => <span class="text-orange-400">{$t('同步的标签页和浏览器相关登录状态会全部失效')}</span>,
                  }}
                </i18n-t>
              </div>
            ),
          }}
        </RxAlert>
      )
    ),
  },
].filter(item => item.visible !== false)

function close() {
  dialogRef.value.close()
  _onCancel.value?.()
}

async function confirm() {
  try {
    await _onConfirm.value?.(value.value)
    close()
  }
  catch (error) {
    console.warn(error)
  }
}

onMounted(() => {
  const { props, onConfirm, onCancel } = dialogRef.value.data
  _props.value = props
  _onConfirm.value = onConfirm
  _onCancel.value = onCancel
})
</script>

<template>
  <div v-if="_props" class="flex flex-col cache">
    <div v-if="_props.title" class="cache-title">
      {{ _props.title }}
    </div>
    <div v-if="_props.content" class="cache-content">
      {{ _props.content }}
    </div>
    <RxInputRadio v-model="value" name="clearType" :options="options" />
    <div class="footer">
      <RxButton size="sm" :label="$t('取消')" text severity="secondary" @click="close" />
      <RxButton size="sm" :label="$t('保存')" severity="info" @click="confirm" />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.cache {
  width: 400px;
  padding-top: 1.25rem;
  gap: var(--spacing-xl, 12px);

  &-title {
    color: var(--colors-text-text-primary, #FAFAFA);
    font-family: Inter;
    font-size: 14px;
    font-style: normal;
    font-weight: 500;
    line-height: normal;
  }

  &-content {
    color: var(--primitives-neutrals-600, #575d61);
    font-family: Inter;
    font-size: 12px;
    font-style: normal;
    font-weight: 400;
    line-height: 18px;
  }

  :deep(.rx-radio-group) {
    flex-direction: column;

    .rx-radio-group-item {
      padding-left: 0;
      border: none;
      min-width: auto;
      box-shadow: none;
    }

    .p-radiobutton-checked+.rx-radio-group-item__text {
      font-weight: 600;
    }
  }
}

.footer {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: var(--spacing-xl, 12px);
  align-self: stretch;
}
</style>
