<script lang="ts" setup>
async function readLocalCookie() {
  try {
    const file = await window.showOpenFilePicker({
      types: [
        {
          description: 'cookies Files',
          accept: {
            'application/json': ['.json'],
          },
        },
      ],
      excludeAcceptAllOption: true,
      multiple: false,
    }).then((handleFile: FileSystemFileHandle[]) => handleFile[0].getFile())

    const reader = new FileReader()
    reader.readAsText(file)
    return new Promise((resolve) => {
      reader.onload = function fileReadCompleted() {
        resolve(reader.result)
      }
    })
  }
  catch (error) {
    console.log('🚀 ~ readLocalCookie ~ error:', error)
  }
}

async function test() {
  const xxx = await readLocalCookie()
  console.log('🚀 ~ test ~ xxx:', xxx)
}
</script>

<template>
  <div class="card flex justify-center" @click="test">
    test
  </div>
</template>
