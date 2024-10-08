<script lang="ts" setup>
import { ref, watch } from 'vue'

const emit = defineEmits(['save'])

const translateResult = ref('')
const translateSuggestionText = ref('')
const translateLoading = ref(false)

const currentRow = defineModel('currentRow', {
  type: Object,
  default: {},
})

function translate() {
  translateSuggestionText.value = ''
  translateLoading.value = true
  fetch('./api/translate', {
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
</script>

<template>
  <div class="flex flex-col gap-[20px]">
    <el-card header="原文" shadow="never">
      {{ currentRow.sourceValue }}
    </el-card>
    <el-card header="翻译" shadow="never">
      <el-input
        v-model="translateResult"
        show-word-limit
        type="textarea"
        placeholder="Enter translation here"
      />
      <el-button type="primary" class="mt-[12px] ml-[86%]" :disabled="!translateResult" @click="saveTranslateResult">
        保存
      </el-button>
    </el-card>

    <el-card style="width: 480px" shadow="hover" header="翻译建议">
      <el-skeleton style="width: 240px" :loading="translateLoading" animated variant="h1" :rows="1">
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
