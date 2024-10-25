<script setup lang="ts">
const value = defineModel({
  type: String,
  default: '',
})

const lineRef = ref()
const lineValue = ref()

function handleTextareaInput() {
  const str = value.value.replace(/\r/g, '').split('\n')
  const n = str.length
  let num = ''
  for (let i = 1; i <= n; i++) {
    num += `${i.toString().padStart(2, '0')}\n`
  }
  lineValue.value = num
}

function syncScroll(event: any) {
  lineRef.value.scrollTop = event.target.scrollTop
}

onMounted(() => {
  handleTextareaInput()
})
</script>

<template>
  <div class="textarea">
    <textarea ref="lineRef" v-model="lineValue" class="textarea-line" wrap="off" cols="2" disabled />
    <textarea v-model="value" spellcheck="false" class="textarea-content" :placeholder="$t('请在此处输入代理信息')" @scroll="syncScroll" @input="handleTextareaInput" />
  </div>
</template>

<style lang="scss" scoped>
.textarea {
  display: flex;
  height: 240px;

  &-line {
    padding: var(--spacing-md, 6px) var(--spacing-md, 6px) var(--spacing-md, 6px) var(--spacing-xl, 12px);
    width: 33px;
    border: none;
    outline: none;
    resize: none;
    overflow: hidden;
    border-right: 0.5px solid var(--Colors-Border-border-container, #c7cdd1);
    background: var(--Colors-Background-bg-page, #fafbfc);

    color: var(--Colors-Text-text-inactive, #a3a9ad);
    text-align: right;
    font-family: 'JetBrains Mono';
    font-size: 12px;
    font-style: normal;
    font-weight: 400;
    line-height: var(--Line-Height-text-lg, 20px);
  }

  &-content {
    flex: 1;
    padding: var(--spacing-md, 6px);
    border: none;
    outline: none;
    resize: none;
    color: var(--Colors-Text-text-primary, #171c1f);
    font-family: 'JetBrains Mono';
    font-size: 12px;
    font-style: normal;
    font-weight: 400;
    line-height: var(--Line-Height-text-lg, 20px);
    background-color: #ffffff;
  }
}
</style>
