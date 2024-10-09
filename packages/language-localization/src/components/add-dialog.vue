<script lang="ts" setup>
import type { FormRules } from 'element-plus'
import { reactive, ref, useTemplateRef } from 'vue'
import { sourceLangKey } from './ISO-639'

const dialogFormVisible = ref(false)
const ruleFormRef = useTemplateRef('ruleForm')
const formLabelWidth = '140px'

const form = reactive({
  key: '',
  value: '',
})

const rules = reactive<FormRules<typeof form>>({
  key: [
    { required: true, message: 'Please input lang key', trigger: 'blur' },
  ],
  value: [
    { required: true, message: 'Please input lang value', trigger: 'blur' },
  ],
})

async function handleSave() {
  if (!ruleFormRef.value)
    return
  await ruleFormRef.value.validate((valid, fields) => {
    if (valid) {
      console.log('submit!')
      dialogFormVisible.value = false
      fetch('./api/saveTranslate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileName: sourceLangKey,
          key: form.key,
          value: form.value,
        }),
      })
      form.key = ''
      form.value = ''
    }
    else {
      console.log('error submit!', fields)
    }
  })
}
</script>

<template>
  <el-button v-bind="$attrs" type="primary" @click="dialogFormVisible = true">
    新增
  </el-button>

  <el-dialog v-model="dialogFormVisible" title="新增 Key" width="500">
    <el-form ref="ruleForm" :model="form" :rules="rules">
      <el-form-item label="Key" prop="key" :label-width="formLabelWidth">
        <el-input v-model="form.key" autocomplete="off" />
      </el-form-item>
      <el-form-item label="Value" prop="value" :label-width="formLabelWidth">
        <el-input v-model="form.value" autocomplete="off" />
      </el-form-item>
    </el-form>
    <template #footer>
      <div class="dialog-footer">
        <el-button @click="dialogFormVisible = false">
          取消
        </el-button>
        <el-button type="primary" @click="handleSave">
          确认
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>
