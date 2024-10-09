<script setup lang="ts">
import { provide, ref, useTemplateRef } from 'vue'
import Header from './header.vue'
import LanguageTree from './language-tree.vue'
import Translator from './translator.vue'

const languageTreeRef = useTemplateRef('languageTree')
const currentRow = ref()
const currentLangKeys = ref<string[]>([])

function handleSave(row: any) {
  console.log(row)
  languageTreeRef.value?.handleSave()
}

function handleLangListChange(langList: any[]) {
  currentLangKeys.value = langList.map(item => item.fileName)
}

provide('mainContext', {
  currentLangKeys,
})
</script>

<template>
  <el-container>
    <el-header class="header">
      <Header />
    </el-header>
    <el-main>
      <el-row :gutter="20">
        <el-col :span="16">
          <LanguageTree ref="languageTree" v-model:current-row="currentRow" @lang-list-change="handleLangListChange" />
        </el-col>
        <el-col :span="8">
          <Translator v-model:current-row="currentRow" @save="handleSave" />
        </el-col>
      </el-row>
    </el-main>
  </el-container>
</template>

<style lang="scss" scoped>
.header {
  border-bottom: 1px solid var(--el-border-color);
}
</style>
