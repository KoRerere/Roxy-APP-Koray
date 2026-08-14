<script setup lang="ts">
import InputLabel from '/@/components/ry-form/input-label.vue'
import RxInputText from '/@/components/ry-form/rx-input-text.vue'
import CookiesItem from './cookies.vue'
import ProxyInfo from './proxy-info/index.vue'
import AccountPlatform from './account-platform.vue'
import RxButton from '/@/components/rx-button'
import { filterInputsByNames } from '/@/utils'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { copyText } from '/@/utils/'
import { useTableContext } from '../hooks/useContext'
import { fetchDefaultWindowName, hasWindowName } from '../utils'

interface Props {
  /** 窗口组 inputs（inputsGroup[0]） */
  windowInputs?: any[]
  /** 模板按钮文案 */
  templateLabel?: string
  /** 是否展示模板选择（编辑页可不传） */
  showTemplate?: boolean
  /** 空名称时是否按日期+序号预填；编辑快速创建配置时关闭，避免把一次性序号写进模板 */
  autofillWindowName?: boolean
}

/** 名称输入项：value 与表单双向绑定，dirId 仅编辑页有 */
interface WindowNameInput {
  value?: string
  dirId?: string
  label?: string
  placeholder?: string
}

const props = withDefaults(defineProps<Props>(), {
  windowInputs: () => [],
  templateLabel: '',
  showTemplate: false,
  autofillWindowName: true,
})

const emit = defineEmits<{
  showTemplates: [event: MouseEvent]
}>()

const [showToast] = useResponseToast()
const { isBatch } = useTableContext()

const basicInputs = computed(() =>
  filterInputsByNames(
    props.windowInputs,
    ['windowName', 'proxyInfoList', 'windowPlatformList', 'cookie'],
  ),
)

const nameInput = computed(() => basicInputs.value[0] as WindowNameInput | undefined)
const proxyInput = computed(() => basicInputs.value[1])
const accountsInput = computed(() => basicInputs.value[2])
const cookieInput = computed(() => basicInputs.value[3])

const cookiePlatformUrls = computed(() => {
  const list = accountsInput.value?.value ?? []
  return list.map((item: any) => item.platformUrl).filter(Boolean)
})

/** 连续 initialize 时丢弃过期回写，避免旧序号盖住新表单 */
let fillSeq = 0

watch(
  () => nameInput.value,
  (input) => {
    // 批量/编辑/快速创建配置/已有名称（含模板回填）不抢写；仅单个创建空名称时预填
    if (!props.autofillWindowName || isBatch.value || !input || input.dirId || hasWindowName(input.value)) {
      return
    }
    void fillDefaultWindowName(input)
  },
  { immediate: true },
)

/** 按「yyMMdd-下一个窗口序号」预填，减少每次手填 */
async function fillDefaultWindowName(input: WindowNameInput) {
  const seq = ++fillSeq
  const name = await fetchDefaultWindowName()
  if (seq !== fillSeq || !name) {
    return
  }
  // 请求返回前用户或模板可能已写入，不再覆盖
  if (hasWindowName(input.value)) {
    return
  }
  input.value = name
}

function onCopy(dirId: string) {
  copyText(dirId)
  showToast(0, $t('复制成功'))
}
</script>

<template>
  <section class="mx-4 mb-2 p-4 basic-info">
    <div class="mb-4 flex items-center justify-between">
      <h2 class="subtitle">
        {{ $t('窗口基础信息') }}
      </h2>
      <RxButton v-if="showTemplate" text severity="secondary" icon="base/rx_ic_template" :label="templateLabel" @click.stop="emit('showTemplates', $event)" />
    </div>

    <div class="flex flex-col gap-4">
      <!-- 窗口名称 -->
      <div v-if="nameInput" class="flex min-w-0 w-full flex-col gap-2">
        <div v-if="nameInput.dirId" class="flex items-center justify-end gap-2.5">
          <span class="text-3 font-[JetBrains_Mono]">ID:{{ nameInput.dirId }}</span>
          <span class="text-3 font-[JetBrains_Mono] color-blue cursor-pointer" @click="onCopy(nameInput.dirId)">
            {{ $t('复制') }}
          </span>
        </div>
        <div class="flex min-w-0 w-full items-center">
          <InputLabel class="shrink-0" :label="nameInput.label" />
          <RxInputText v-model="nameInput.value" class="min-w-0 flex-1" :placeholder="nameInput.placeholder" />
        </div>
      </div>
      <!-- 代理信息 -->
      <ProxyInfo v-if="proxyInput" v-model="proxyInput.value" />

      <!-- 账号平台 -->
      <AccountPlatform v-if="accountsInput" v-model="accountsInput.value" />

      <!-- Cookies -->
      <CookiesItem v-if="cookieInput" v-model="cookieInput.value" v-model:invalid="cookieInput.invalid" :platform-urls="cookiePlatformUrls" v-bind="cookieInput" />
    </div>
  </section>
</template>

<style lang="scss" scoped>
.subtitle {
  color: var(--colors-text-text-primary);
  font-size: 16px;
  font-weight: 600;
  line-height: 20px;
  margin: 0;
}

:deep(.rx-label) {
  text-align: right;
  max-width: 100px;
  min-width: 100px !important;
}
</style>
