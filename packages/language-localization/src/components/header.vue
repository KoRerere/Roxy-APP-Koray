<script setup lang="ts">
import { ElMessage } from 'element-plus'
import { ref } from 'vue'
import LangSelect from './lang-select.vue'

const dialogFormVisible = ref(false)
const lang = ref('')

function handlePublish() {
  ElMessage.error('开发中...')
}

function handleCreateLang() {
  if (!lang.value) {
    ElMessage.error('请选择语言')
    return
  }
  console.log('新增语言: ', lang.value)
  lang.value = ''
  dialogFormVisible.value = false
}
</script>

<template>
  <div class="flex justify-between">
    <div>
      <el-button type="primary" @click="dialogFormVisible = true">
        新增语言
      </el-button>
    </div>
    <div>
      <el-button type="primary" @click="handlePublish">
        发布
      </el-button>
    </div>
  </div>

  <el-dialog v-model="dialogFormVisible" title="新增语言" width="450">
    <el-form>
      <el-form-item label="语言">
        <LangSelect v-model="lang" />
      </el-form-item>
    </el-form>
    <template #footer>
      <div class="dialog-footer">
        <el-button @click="dialogFormVisible = false">
          取消
        </el-button>
        <el-button type="primary" @click="handleCreateLang">
          确认
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<style lang="scss" scoped>

</style>
