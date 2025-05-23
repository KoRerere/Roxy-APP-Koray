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
    <textarea v-model="value" spellcheck="false" class="textarea-content" :placeholder="$t('请在此处输入代理信息')"
      @scroll="syncScroll" @input="handleTextareaInput" />
  </div>
</template>

<style lang="scss" scoped>
.textarea {
  display: flex;
  height: 240px;

  &-line {
    padding: var(--spacing-md, 6px) var(--spacing-md, 6px) var(--spacing-md, 6px) var(--spacing-xl, 12px);
    width: 40px;
    border: none;
    outline: none;
    resize: none;
    overflow: hidden;
    border-right: 0.5px solid var(--colors-border-border-base, #34393d);
    background-color: var(--colors-background-bg-action, #293038);

    color: var(--colors-text-text-tertiary, #7d8387);
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
    color: var(--colors-text-text-tertiary, #7d8387);
    font-family: 'JetBrains Mono';
    font-size: 12px;
    font-style: normal;
    font-weight: 400;
    line-height: var(--Line-Height-text-lg, 20px);
    background-color: var(--colors-background-bg-action, #293038);
  }
}
</style>
