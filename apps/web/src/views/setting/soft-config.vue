<script setup lang="ts">
import { API } from '/@/api'
import { getFormData, setInputFieldByInputKey } from '/@/utils'

import { useToast } from 'primevue/usetoast'

import { useDebounceFn } from '@vueuse/core'

const toast = useToast()

const form = {
  closeSoft: 'pop',
  cacheDir: '',
  memoryLimit: 95,
}

function getInputs(data: any) {
  return [
    {
      type: 'radio',
      name: 'closeSoft',
      label: '软件关闭时',
      value: data.closeSoft,
      options: [
        { label: '弹出提示', value: 'pop' },
        { label: '最小化', value: 'min' },
        { label: '直接关闭', value: 'exit' },
      ],
    },
    {
      type: 'text',
      name: 'cacheDir',
      label: '文件缓存目录',
      value: data.cacheDir,
      onClick: useDebounceFn(async () => {
        const dir = await window.electronAPI.send('dialog:selectDir')
        console.log('dialog:selectDir', dir)
        if (dir) {
          setInputFieldByInputKey(inputs.value, 'cacheDir', 'value', dir)
        }
      }),
    },
    {
      type: 'text',
      name: 'memoryLimit',
      label: '性能监控',
      value: data.memoryLimit,
    },
  ]
}

const inputs = ref(getInputs(form))

onMounted(async () => {
  console.log('mounted')
  getSoftConfig()
  // 检查本地插件是否有更新, 返回的是需要更新的插件 ID 字符串数组
  const res = await window.electronAPI.send('extension:checkLocalExtensionUpdate', [{
    extID: 'anlikcnbgdeidpacdbdljnabclhahhmd',
    newVersion: '6.0.1',
  }])

  console.log('checkLocalExtensionUpdate', res)

  // 获取本地已安装的插件
  const result = await window.electronAPI.send('extension:getInstalledExtensions')

  console.log('extension:getInstalledExtensions', result)
})

async function getSoftConfig() {
  const { code, data } = await API.base.userGetUserConfigList()

  if (code === 0) {
    inputs.value = getInputs(data)
  }
}

async function handleSubmit() {
  const params = getFormData(inputs.value)
  const { code } = await API.base.userSetUserConfigCreate(params)

  if (code === 0) {
    toast.add({ severity: 'success', summary: 'Success', detail: '保存成功', life: 5000 })
    window.electronAPI.send('app:saveSoftConfig', params)
  }
  else {
    toast.add({ severity: 'error', summary: 'Error', detail: '保存失败', life: 5000 })
  }

  console.log('submit', params)
}

const openLogDir = () => window.electronAPI.send('app:showLogDir')

const exeInfo = ref({})
async function selectExtension(selectType: 'dir' | 'file') {
  try {
    // 选择并解析本地插件
    const res = await window.electronAPI.send('extension:getSelectedExtensionInfo', selectType)
    exeInfo.value = res.data
    console.log('selectExtension', res)
    const { pluginDir, pluginIcon } = res.data
    // 上传插件到OSS
    const uploadResult = await window.electronAPI.send('extension:uploadExtensionToOSS', { pluginDir, pluginIcon })
    console.log('uploadResult', uploadResult)
  }
  catch (error) {
    console.log('selectExtension error', error)
  }
}
</script>

<template>
  <div>软件设置</div>
  <ry-form :inputs="inputs" label-position="left" />
  <div class="mt-[12px]">
    系统日志
    <ry-button class="ml-[12px]" @click="openLogDir">
      打开日志目录
    </ry-button>
  </div>
  <div class="mt-[12px]">
    扩展管理
    <ry-button class="ml-[12px]" @click="() => selectExtension('dir')">
      选择扩展目录
    </ry-button>
    <ry-button class="ml-[12px]" @click="() => selectExtension('file')">
      选择扩展文件
    </ry-button>
    <img :src="exeInfo?.pluginIcon" alt="" srcset="">
  </div>
  <ry-button class="w-full mt-[12px]" @click="handleSubmit">
    保存
  </ry-button>
</template>
