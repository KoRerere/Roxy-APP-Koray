<script setup>
import { ref } from 'vue'
import { usePrimeVue } from 'primevue/config'
import { useToast } from 'primevue/usetoast'

const $primevue = usePrimeVue()
const toast = useToast()

const totalSize = ref(0)
const totalSizePercent = ref(0)
const files = ref([])

function onRemoveTemplatingFile (file, removeFileCallback, index) {
  removeFileCallback(index)
  totalSize.value -= Number.parseInt(formatSize(file.size))
  totalSizePercent.value = totalSize.value / 10
}

function onClearTemplatingUpload (clear) {
  clear()
  totalSize.value = 0
  totalSizePercent.value = 0
}

function onSelectedFiles (event) {
  files.value = event.files
  files.value.forEach((file) => {
    totalSize.value += Number.parseInt(formatSize(file.size))
  })
}

function uploadEvent (callback) {
  totalSizePercent.value = totalSize.value / 10
  callback()
}

function onTemplatedUpload () {
  toast.add({ severity: 'info', summary: 'Success', detail: 'File Uploaded', life: 3000 })
}

function formatSize (bytes) {
  const k = 1024
  const dm = 3
  const sizes = $primevue.config.locale.fileSizeTypes

  if (bytes === 0) {
    return `0 ${sizes[0]}`
  }

  const i = Math.floor(Math.log(bytes) / Math.log(k))
  const formattedSize = Number.parseFloat((bytes / k ** i).toFixed(dm))

  return `${formattedSize} ${sizes[i]}`
}
</script>

<template>
  <div class="pa-50px">
    <div>
      Please download our <a>template file</a> here. After you finish editing, upload it through the
      following steps.
    </div>
    <div>* We only support create up to 500 profiles every time.</div>
    <FileUpload :pt="{ root: 'upload-custome' }" name="demo[]" url="/api/upload" :multiple="true" accept="image/*"
      :max-file-size="1000000" @upload="onTemplatedUpload($event)" @select="onSelectedFiles">
      <template #header="{ chooseCallback }">
        <Button class="upload-btn" icon="pi pi-upload" label="Upload template file" outlined severity="secondary"
          @click="chooseCallback()" />
      </template>
      <template #content="{ files, uploadedFiles, removeUploadedFileCallback, removeFileCallback }">
        <!-- <div v-if="files.length > 0">
            <h5>Pending</h5>
            <div class="flex flex-wrap gap-4">
              <div v-for="(file, index) of files" :key="file.name + file.type + file.size"
                class="p-8 rounded-border flex flex-col border border-surface items-center gap-4">
                <div>
                  <img role="presentation" :alt="file.name" :src="file.objectURL" width="100" height="50">
                </div>
                <span class="font-semibold text-ellipsis max-w-60 whitespace-nowrap overflow-hidden">{{ file.name
                  }}</span>
                <div>{{ formatSize(file.size) }}</div>
                <Badge value="Pending" severity="warn" />
                <Button icon="pi pi-times" outlined rounded severity="danger"
                  @click="onRemoveTemplatingFile(file, removeFileCallback, index)" />
              </div>
            </div>
          </div>

          <div v-if="uploadedFiles.length > 0">
            <h5>Completed</h5>
            <div class="flex flex-wrap gap-4">
              <div v-for="(file, index) of uploadedFiles" :key="file.name + file.type + file.size"
                class="p-8 rounded-border flex flex-col border border-surface items-center gap-4">
                <div>
                  <img role="presentation" :alt="file.name" :src="file.objectURL" width="100" height="50">
                </div>
                <span class="font-semibold text-ellipsis max-w-60 whitespace-nowrap overflow-hidden">{{ file.name
                  }}</span>
                <div>{{ formatSize(file.size) }}</div>
                <Badge value="Completed" class="mt-4" severity="success" />
                <Button icon="pi pi-times" outlined rounded severity="danger"
                  @click="removeUploadedFileCallback(index)" />
              </div>
            </div>
          </div> -->
        <div class="upload-area">
          <span class="mdi mdi-file-outline upload-area-icon" />
          <div class="text-center">
            <div>Choose file and drop it here</div>
            <div>Only .xlsx files supported, up to 50MB.</div>
          </div>
          <Button class="invisible" label="placeholader" outlined severity="secondary" />
        </div>
      </template>
    </FileUpload>
  </div>
</template>

<style lang="scss" scoped>
:deep(.p-fileupload-header) {
  padding: 0;
  margin: 0;
  height: 0;
}

:deep(.p-fileupload-content) {
  padding: 0;
}

.upload-custome {
  position: relative;
  border: none;
}

.upload-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  align-self: stretch;
  padding: var(--oversize-spacing-4rem, 64px) var(--spacing-none, 0px);
  gap: var(--spacing-2xl, 16px);
  border-radius: var(--Component-Colors-TextInput-radius-radius-lg, 8px);
  border: 1px dashed var(--Colors-Border-border-container, #c7cdd1);
  background: var(--Color-neutrals-50, #fafbfc);

  &-icon {
    font-size: 48px;
    line-height: 1;
  }
}

.upload-btn {
  position: absolute !important;
  bottom: var(--oversize-spacing-4rem, 64px);
  left: 50%;
  transform: translate(-50%);
  z-index: 1;
}
</style>
