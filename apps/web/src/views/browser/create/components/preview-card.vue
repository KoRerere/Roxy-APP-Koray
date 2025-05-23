<script setup lang="ts">
const props = defineProps({
  inputsGroup: {
    type: Array,
    default: () => [],
  },
  onShuffle: {
    type: Function as PropType<() => void>,
    default: () => () => { },
  },
})

const previewData = computed(() => {
  return getPreview(props.inputsGroup.flat())
})

function getPreview(list: any[]) {
  const _list: any = []

  list.forEach((item) => {
    if (item.preview) {
      _list.push(item)
    }
    else if (item.items && Array.isArray(item.items)) {
      item.items.forEach((subItem: any) => {
        if (subItem.preview) {
          _list.push(subItem)
        }
      })
    }
  })

  return _list.map(({ options, value, preview }: any) => {
    const _value = (value?.value || value)
    const pvalue = Array.isArray(options)
      ? options.find((option: any) => option.value === _value)?.label
      : _value
    return {
      ...preview,
      value: pvalue,
    }
  })
}

const visible = ref(true)
</script>

<template>
  <div class="flex flex-col items-start preview" :class="[visible ? '' : 'hide']">
    <div class="flex flex-row-reverse items-center justify-between self-stretch preview-header">
      <SvgIcon class="ma-1 cursor-pointer" :class="{ 'rotate-180': visible }" color="#575D61"
        name="base/rx_ic_fold_right" @click="visible = !visible" />
      <span v-if="visible">{{ $t('概要') }}</span>
    </div>
    <div v-if="visible" class="w-full preview-content">
      <div class="preview-content-list">
        <div v-for="(item, key) in previewData" :key="key" class="preview-content-item">
          <div class="preview-content-item-label">
            {{ item.label }}
          </div>
          <div class="preview-content-item-value">
            {{ item.value }}
          </div>
        </div>
        <div class="h-6 w-full invisible" />
      </div>
    </div>
    <div v-if="visible" class="preview-footer">
      <RxButton :label="$t('一键随机指纹')" icon="base/rx_ic_shuffle" outlined @click="onShuffle" />
    </div>
  </div>
</template>

<style lang="scss" scoped>
$spacing-x: var(--spacing-xl, 12px);

.preview {
  margin: 12px;
  margin-left: 0;
  padding: var(--spacing-lg, 8px) 0;
  gap: var(--spacing-md, 6px);
  width: 340px;
  height: calc(100% - 24px);
  border-radius: 8px;
  border: 0.5px solid var(--colors-border-border-base, #c7cdd1);
  background: var(--colors-background-bg-app, #fff);
  box-shadow:
    0px 3px 8px 0px rgba(0, 0, 0, 0.07),
    0px 2px 5px 0px rgba(0, 0, 0, 0.07),
    0px 1px 1px 0px rgba(0, 0, 0, 0.07);
  transition: all 0.3s ease-in;

  &.hide {
    width: 49px;
    height: 41px;
  }

  &-header {
    padding: 0 $spacing-x;
    color: var(--colors-text-text-primary, #fafafa);
    font-family: Inter;
    font-size: 12px;
    font-weight: 600;
    line-height: normal;
  }

  &-content {
    position: relative;
    flex: 1;
    overflow: hidden;
    word-break: break-all;

    &::after {
      content: ' ';
      position: absolute;
      left: 0;
      bottom: 0;
      width: 100%;
      height: 44px;
      background: linear-gradient(0deg, #fff 0%, rgba(255, 255, 255, 0) 100%);
    }

    &-list {
      padding: 0 $spacing-x;
      width: 100%;
      height: 100%;
      overflow-y: auto;

      &::-webkit-scrollbar {
        display: none;
      }
    }

    &-item {
      display: flex;
      padding: var(--spacing-md, 6px) 10px;
      align-items: flex-start;
      align-self: stretch;
      gap: var(--spacing-sm, 4px);
      color: var(--primitives-neutrals-800, #252a2e);
      font-family: 'DM Mono';
      font-size: 12px;
      font-weight: 500;
      line-height: 1.3;

      &-label {
        width: 120px;
        word-wrap: break-word;
      }

      &-value {
        flex: 1;
      }
    }
  }

  &-footer {
    display: flex;
    align-self: stretch;
    align-items: center;
    justify-content: flex-end;
    padding: 0 $spacing-x;
    height: 40px;
  }
}
</style>
