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
const _emit = defineEmits(['confirm'])

const inputs: any = computed(() => [{
  type: 'textarea',
  placeholder: 'Paste your cookies with JSON format',
  name: 'cookies',
  value: props.data.cookies,
  icon: 'mdi mdi-paperclip',
  rows: 46,
  autoResize: false,
  formatValue: (self: any) => {
    return self.value
    // ? JSON.parse(self.value).map(({ name, value, domain }) => ({ name, value, domain }))
    // : value
  },
  onBlur(self: any) {
    console.log('🚀 ~ onBlur ~ self:', self)
  },
}])

const isWrap = ref(false)
</script>

<template>
  <drawerContent title="编辑 cookies" v-bind="$attrs">
    <ryForm :inputs="inputs" />
    <template #footer>
      <div class="flex justify-between w-full">
        <div class="flex items-center">
          <Checkbox v-model="isWrap" input-id="wrap" binary />
          <label for="wrap" class="select-none ml-2 cursor-pointer">Text wrap</label>
        </div>
        <ry-button label="Save Cookies" severity="info" />
      </div>
    </template>
  </drawerContent>
</template>

<style scoped></style>
