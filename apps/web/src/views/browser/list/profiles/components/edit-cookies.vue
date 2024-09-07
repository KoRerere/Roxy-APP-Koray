<script setup lang="ts">
import ryForm from '/@/components/ry-form'
import drawerContent from '/@/components/drawer-content.vue'

const props = defineProps({
  data: {
    type: Object,
    default: () => ({}),
  },
  title: {
    type: String,
    default: '创建代理',
  },
})

const emit = defineEmits(['confirm'])

const cookies = ref(props.data.cookies)

const isWrap = ref(false)

function chechCookies() {
  return false
}

function onBlur() {
  // console.log('🚀 ~ onBlur ~ event:', cookies.value)
}

function onConfirm() {
  if (chechCookies()) {
    emit('confirm', cookies.value)
  }
}
</script>

<template>
  <drawerContent title="编辑 cookies" v-bind="$attrs">
    <Textarea v-model="cookies" class="cookies-textarea" placeholder="Paste your cookies with JSON format" cols="40"
      :auto-resize="false" @blur="onBlur" />
    <template #footer>
      <div class="flex justify-between w-full">
        <div class="flex items-center">
          <Checkbox v-model="isWrap" input-id="wrap" binary />
          <label for="wrap" class="select-none ml-2 cursor-pointer">Text wrap</label>
        </div>
        <ry-button label="Save Cookies" severity="info" @click="onConfirm" />
      </div>
    </template>
  </drawerContent>
</template>

<style lang="scss" scoped>
.cookies-textarea {
  // margin: var(--spacing-2xl, 16px) 0;
  margin-top: var(--spacing-2xl, 16px);
  resize: none;
  height: calc(100% - var(--spacing-2xl, 16px));
}
</style>
