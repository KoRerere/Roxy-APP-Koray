<script setup lang="ts">
import { ref } from 'vue'

const props = defineProps<{
  dirName: string
}>()

let id = 0
const file = ref(null)
const uploadResult = ref({})

try {
  const result = sessionStorage.getItem(props.dirName)
  if (result) {
    uploadResult.value = JSON.parse(result)
  }
}
catch (error) {

}

function handleFileChange(event: any) {
  file.value = event.target.files[0]
}

async function uploadFile() {
  if (!file.value) {
    uploadResult.value.message = 'Please select a file!'
    return
  }

  const formData = new FormData()
  formData.append('file', file.value)
  formData.append('dirName', props.dirName)

  try {
    const response = await fetch('/__upload-icons', {
      method: 'POST',
      body: formData,
    })

    if (response.ok) {
      file.value = null
      uploadResult.value = await response.json()
      console.log('result', uploadResult.value)
      sessionStorage.setItem(props.dirName, JSON.stringify(uploadResult.value))
      location.reload()
    }
    else {
      uploadResult.value.message = 'File upload failed'
    }
  }
  catch (error) {
    uploadResult.value.message = 'Error occurred while uploading'
  }
  finally {
    id++
  }
}

function openFile() {
  const filePath = `/__open-folder?folder=${uploadResult.value.saveDir}`
  fetch(filePath)
}
</script>

<template>
  <input :key="id" type="file" accept="application/zip" @change="handleFileChange">
  <rx-button :disabled="!file" size="small" @click="uploadFile">
    确认上传
  </rx-button>
  <details v-if="uploadResult.saveDir" class="flex flex-1 ml-3">
    <summary>
      解压成功： <a class="cursor-pointer" @click="openFile">{{ uploadResult.saveDir }}</a>
    </summary>
    <div class="flex gap-2 flex-wrap h-[300px] overflow-auto">
      <template v-for="(name, index) in uploadResult.files" :key="name">
        <div>
          <button> {{ index + 1 }}. {{ name }}</button>
        </div>
      </template>
    </div>
  </details>
</template>

<style>
/* Add your styles here */
</style>
