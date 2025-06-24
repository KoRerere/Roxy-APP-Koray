<script setup lang="ts">
import { getDefaultWindowName } from '/@/views/browser/create/utils'
import { API } from '/@/api'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { isLikeFunction } from '/@/utils'

interface Props {
  workspaceName?: string
  data: Record<string, any>
  openMessage?: Record<string, any>
  showSort?: boolean,
  disabled?: boolean
  readonly?: boolean
  filterKeys?: string[]
}

const {
  data,
  disabled = false,
  readonly = false
} = defineProps<Props>()

const emits = defineEmits(['refresh'])

const defaultWindowName = getDefaultWindowName()
const windowName = ref(data.windowName)

const [showToast, onlyErrorToast] = useResponseToast()

async function updateProfile(params: any, options?: Record<string, any>) {
  const { isRefresh, fallback, success } = { isRefresh: false, success: () => { }, fallback: () => { }, ...options }
  const { code, msg } = await API.window.userMdfWindowInfoSingleV2Create(params)
  onlyErrorToast(code, msg)
  if (code === 0) {
    isLikeFunction(success) && success()
    if (isRefresh) {
      emits('refresh')
    }
  } else {
    isLikeFunction(fallback) && fallback()
  }
}

function saveWindowName(closeCallback: () => void) {
  const name = windowName.value.trim()
  const oldName = data.windowName
  if (name !== oldName) {
    data.windowName = name
    updateProfile({ id: data.id, windowName: name }, {
      fallback: () => {
        windowName.value = oldName
        data.windowName = oldName
      }
    })
  } else {
    windowName.value = data.windowName
  }
  closeCallback()
}

function handleFocusWindowName() {
  windowName.value = windowName.value.startsWith(defaultWindowName) ? '' : windowName.value
}

function handleClickInplace(e: MouseEvent) {
  if (disabled || readonly) return
  e.stopPropagation()
}
</script>

<template>
  <div>
    <Inplace v-focustrap :disabled="disabled || readonly" @click="handleClickInplace">
      <template #display>
        <div class="profile-name-content">{{ windowName }}</div>
      </template>
      <template #content="{ closeCallback }">
        <InputText v-model="windowName" autofocus size="small" class="window-name-input" @blur="saveWindowName(closeCallback)" @focus="handleFocusWindowName"
          @keydown.enter="saveWindowName(closeCallback)" />
      </template>
    </Inplace>
  </div>
</template>

<style lang="scss" scoped>
.profile-name-content {
  width: 160px;
  height: 26px;
  padding: 4px 8px;
  overflow: hidden;
  text-overflow: ellipsis;
  border: 1px solid transparent;
  border-radius: 4px;

  &:hover {
    border: 1px solid var(--pattern-profiles-input-border);
    background: var(--pattern-profiles-input-bg);
  }
}

:deep(.p-inplace-display) {
  display: flex;
  border: 0 none;
  padding: 0;

  &:focus-visible {
    outline-color: transparent;
  }
}

.window-name-input {
  font-size: 12px;
  border-radius: 4px;
  box-shadow: none !important;
  line-height: 16px;
  padding: 4px 8px;
  width: 160px;
}
</style>