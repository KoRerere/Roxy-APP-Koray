<script lang="ts" setup>
import 'element-plus/es/components/message/style/css'
import { CopyDocument } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { computed, ref, watch } from 'vue'

const emit = defineEmits(['save'])

const translateResult = ref('')
const translateSuggestionText = ref('')
const translateLoading = ref(false)

const currentRow = defineModel('currentRow', {
  type: Object,
  default: {},
})

let controller: AbortController

const disabledSaveBtn = computed(() => {
  return !translateResult.value || !currentRow.value.targetKey
})

function translate() {
  controller?.abort()
  controller = new AbortController()
  translateSuggestionText.value = ''
  translateLoading.value = true
  fetch('./api/translate', {
    signal: controller.signal,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text: currentRow.value.sourceValue,
      from: currentRow.value.sourceKey,
      to: currentRow.value.targetKey,
    }),
  }).then(res => res.text()).then((text) => {
  // googleTranslator.translateText('A bird in hand is worth two in the bush.', 'auto', 'zh-CN')
    console.log('翻译结果: ', text)
    translateSuggestionText.value = text
    translateLoading.value = false
  }).catch((err) => {
    console.log(err.message)
  })
}

function saveTranslateResult() {
  console.log('保存翻译结果: ', translateResult.value)
  currentRow.value.targetValue = translateResult.value
  emit('save', currentRow.value)
}

watch(currentRow, () => {
  translateResult.value = currentRow.value.targetValue
  console.log('currentRow changed: ', currentRow.value)
  translate()
})

function handleCopy() {
  navigator.clipboard.writeText(currentRow.value.sourceValue).then(() => {
    ElMessage.success('复制成功')
  }).catch(() => {
    ElMessage.error('复制失败')
  })
}
</script>

<template>
  <div class="flex flex-col gap-[20px]">
    <el-card header="原文" shadow="never">
      {{ currentRow.sourceValue }}
      <CopyDocument v-if="currentRow.sourceValue" class="w-[14px] h-[14px] cursor-pointer align-middle" @click="handleCopy" />
    </el-card>
    <el-card header="译文" shadow="never">
      <el-input
        v-model="translateResult"
        show-word-limit
        type="textarea"
        placeholder="Enter translation here"
      />
      <el-button type="primary" class="mt-[12px] ml-[86%]" :disabled="disabledSaveBtn" @click="saveTranslateResult">
        保存
      </el-button>
    </el-card>

    <el-card shadow="hover" header="翻译建议">
      <el-skeleton :loading="translateLoading" animated variant="h1" :rows="1">
        <div class="cursor-pointer" @click="translateResult = translateSuggestionText">
          {{ translateSuggestionText }}
        </div>
      </el-skeleton>
      <template v-if="!translateLoading" #footer>
        <div class="text-right text-[12px]">
          -- 来自谷歌翻译
        </div>
      </template>
    </el-card>
  </div>
</template>
