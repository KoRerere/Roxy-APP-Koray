<script setup lang="ts">
import type { UnwrapRowsType, UserGetWindowInfoV2ListData } from '@roxy/backend-api';
import { useWorkspaceStore } from '/@/stores/workspace';
import { RxSvgIcon } from '/@/components/rx-icon';
import { useResizeObserver } from '@vueuse/core';

const props = defineProps({
  syncWindows: {
    type: Array as PropType<UnwrapRowsType<UserGetWindowInfoV2ListData>>,
    default: () => []
  }
})

// 零宽字符
const zeroWidthSpace = '\u200B'
const splitChar = `${zeroWidthSpace}\n`
const workspaceStore = useWorkspaceStore()
const diffTextRef = useTemplateRef('diffText')
const textareaRef = useTemplateRef('textarea')
const text = ref('')
const textMap = ref<Recordable>({})

const workspaceName = computed(() => {
  return workspaceStore.currentWorkspace?.workspaceName?.slice(0, 3).toLocaleUpperCase()
})

watch(() => props.syncWindows, (val) => {
  val.forEach((window) => {
    textMap.value[window.dirId!] ||= ''
  })
  text.value = splitChar.repeat(props.syncWindows.length - 1)
}, { once: true })

watch(text, (val) => {
  const textArr = val.split(splitChar)
  const textMapKeys = Object.keys(textMap.value)
  textArr.forEach((text, index) => {
    if (textMapKeys[index]) {
      // 去掉字符串前后的换行符
      textMap.value[textMapKeys[index]] = text.replace(/^[\u200B\n]+|[\u200B\n]+$/g, '')
    }
  })
}, { immediate: true })

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    const { selectionStart } = e.target as HTMLTextAreaElement
    if (e.shiftKey) {
    } else {
      e.preventDefault()
      const selectionNumber = text.value[selectionStart + 1] === zeroWidthSpace ? 2 : 1
      const position = selectionStart + selectionNumber
      textareaRef.value.$el?.setSelectionRange(position, position)
    }
  }
}

useResizeObserver(diffTextRef, (entries) => {
  const entry = entries[0]
  const { width, height } = entry.contentRect
  console.log('width', width, 'height', height)
  const target = entry.target as HTMLElement
  const scrollHeight = target.scrollHeight - target.clientHeight
  if (scrollHeight > 0) {
    electronAPI.send('syncControl:resizeBatchInputsDialog', { width: 480, height: window.innerHeight + scrollHeight })
  }
})

function handlePaste(e: ClipboardEvent) {
  // 标准化换行符, 统一为 LF 换行
  const text = e.clipboardData?.getData('text').replace(/\r\n|\r/g, "\n");
  console.log('text', text)
  if (text) {
    const textArr = text.split('\n')
    const textMapKeys = Object.keys(textMap.value)
    textArr.forEach((text, index) => {
      if (textMapKeys[index]) {
        textMap.value[textMapKeys[index]] = text
      }
    })
    console.log('textMap', textMap.value)
  }
}

defineExpose({
  get formData() {
    return props.syncWindows.reduce((acc, window) => {
      if (textMap.value[window.dirId!]) {
        acc[window.$pId] = textMap.value[window.dirId!]
      }
      return acc
    }, {})
  }
})
</script>

<template>
  <div class="diff-text" ref="diffText">
    <template v-for="(window, index) in syncWindows" :key="window.dirId">
      <div class="form-item">
        <div class="form-item-label">
          <label for="diff-text">
            <span class="profile-name">{{ workspaceName }}-{{ window.windowSortNum }}</span>
          </label>
        </div>
        <Textarea v-model="textMap[window.dirId!]" class="textarea" rows="1" unstyled autoResize disabled />
      </div>
    </template>
    <Textarea ref="textarea" v-model="text" class="textarea-all" rows="1" unstyled autoResize @paste="handlePaste"
      @keydown="handleKeydown" />
  </div>
  <div class="mt-[8px] text-right">
    {{ $t('输入 ↵ 切换至下一个窗口，输入 Shift + ↵ 当前文本换行') }}
  </div>
</template>


<style lang="scss" scoped>
.diff-text {
  height: 100%;
  position: relative;
  display: flex;
  flex-direction: column;
  padding: 10px 8px 10px 12px;
  overflow: auto;
  line-height: 22px;
  border-radius: var(--Component-Colors-TextInput-radius-radius-lg, 8px);
  border: 1px solid var(--colors-border-border-base, #C7CDD1);
  box-shadow: 0px 1px 2px 0px rgba(16, 24, 40, 0.05);
  background: var(--colors-background-bg-page, #FAFBFC);

  textarea {
    line-height: 22px;
  }

  &::after {
    content: '';
    position: absolute;
    top: 0;
    bottom: 0;
    left: 110px;
    width: 1px;
    background: var(--colors-border-border-base, #C7CDD1);
  }

  .textarea-all {
    position: absolute;
    inset: 0;
    left: 110px;
    border: none;
    resize: none;
    padding: 10px 8px 10px 12px;
    background-color: white;
  }
}

.form-item {
  display: flex;
  align-items: flex-start;

  .form-item-label {
    width: 100px;
    flex-shrink: 0;
    color: var(--colors-text-text-primary, #fafafa);

  }


  .textarea {
    width: 100%;
    border: none;
    resize: none;
    padding: 0;
    opacity: 0;
    background-color: red;
  }
}
</style>
