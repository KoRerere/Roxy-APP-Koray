<template>
  <div class="botton-box flex align-center">
    <Button class="install" @click="clickInstallBtn">
      <img class="icon" src="/@/assets/image/extension/rx_ic_download_url.svg" alt="">
      <span>Install via URL</span>
    </Button>

    <Button @click="uploadFile" class="upload">
      <img class="icon" src="/@/assets/image/extension/rx_ic_upload.svg" alt="">
      <span>Uplod</span>
    </Button>


    <div class="line"></div>

    <Button class="update">
      <img class="icon" src="/@/assets/image/extension/rx_ic_clock_rotate.svg" alt="">
      <span>Update All</span>
    </Button>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{}>();

const emits = defineEmits(['openInstallPop', 'openUploadPop']);



function clickInstallBtn() {
  emits('openInstallPop')
}

// 上传文件
function uploadFile() {
  emits('openUploadPop')
}
</script>

<style scoped lang="scss">
.botton-box {
  display: flex;
  align-items: center;
  gap: var(--spacing-lg, 8px);

  .icon {
    width: 16px;
    height: 16px;
  }

  .line {
    width: 1px;
    height: 16px;
    background: var(--Colors-Border-border-container, #C7CDD1);
  }

  .install {
    display: flex;
    min-width: 24px;
    padding: var(--spacing-sm, 4px) var(--spacing-md, 6px);
    justify-content: center;
    align-items: center;
    gap: var(--spacing-sm, 4px);
    border-radius: var(--radius-sm, 4px);
    border: 0.5px solid var(--Component-Colors-Buttons-Primary-border, #0881CC);
    background: var(--Component-Colors-Buttons-Primary-bg, #12A3FC);
    box-shadow: 0px 4px 4px -1px rgba(0, 0, 0, 0.02), 0px 1px 1px 0px rgba(0, 0, 0, 0.06);
    color: var(--Component-Colors-Buttons-Primary-text, #FFF);
    text-align: center;
    font-family: Inter;
    font-size: var(--Font-Size-text-sm, 12px);
    font-style: normal;
    font-weight: 500;
    line-height: var(--Line-Height-text-xs, 16px);
    /* 133.333% */

    cursor: pointer;
  }

  .upload {
    display: flex;
    min-width: 24px;
    padding: var(--spacing-sm, 4px) var(--spacing-md, 6px);
    justify-content: center;
    align-items: center;
    gap: var(--spacing-sm, 4px);
    border-radius: var(--radius-sm, 4px);
    border: 0.5px solid var(--Component-Colors-Buttons-Secondary-border, #C7CDD1);
    background: var(--Component-Colors-Buttons-Secondary-bg, #FFF);
    box-shadow: 0px 4px 4px -1px rgba(0, 0, 0, 0.02), 0px 1px 1px 0px rgba(0, 0, 0, 0.06);
    color: var(--Component-Colors-Buttons-Secondary-text, #171C1F);
    text-align: center;
    font-family: Inter;
    font-size: var(--Font-Size-text-sm, 12px);
    font-style: normal;
    font-weight: 600;
    line-height: var(--Line-Height-text-xs, 16px);
    /* 133.333% */
    cursor: pointer;
  }

  .update {
    display: flex;
    min-width: 24px;
    padding: var(--spacing-sm, 4px) var(--spacing-md, 6px);
    justify-content: center;
    align-items: center;
    gap: var(--spacing-sm, 4px);
    border-radius: var(--radius-sm, 4px);
    border: 0.5px solid var(--Component-Colors-Buttons-Secondary-border, #C7CDD1);
    background: var(--Component-Colors-Buttons-Secondary-bg, #FFF);
    box-shadow: 0px 4px 4px -1px rgba(0, 0, 0, 0.02), 0px 1px 1px 0px rgba(0, 0, 0, 0.06);
    color: var(--Component-Colors-Buttons-Secondary-text, #171C1F);
    text-align: center;
    font-family: Inter;
    font-size: var(--Font-Size-text-sm, 12px);
    font-style: normal;
    font-weight: 600;
    line-height: var(--Line-Height-text-xs, 16px);
    /* 133.333% */
    cursor: pointer;
  }
}
</style>
