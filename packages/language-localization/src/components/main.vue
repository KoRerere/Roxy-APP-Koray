<script setup lang="ts">
import { ref, useTemplateRef } from 'vue'
import LanguageTree from './language-tree.vue'
import Translator from './translator.vue'

const languageTreeRef = useTemplateRef('languageTree')
const currentRow = ref()

function handleSave(row: any) {
  console.log(row)
  languageTreeRef.value?.handleSave()
}
</script>

<template>
  <el-row :gutter="20">
    <el-col :span="16">
      <LanguageTree ref="languageTree" v-model:current-row="currentRow" />
    </el-col>
    <el-col :span="8">
      <Translator v-model:current-row="currentRow" @save="handleSave" />
    </el-col>
  </el-row>
</template>
