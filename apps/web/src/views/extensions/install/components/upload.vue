<template>
    <div @click="uploadFile" class="upload">
        <img class="upload-icon" src="/@/assets/image/extension/rx_ic_upload.svg" alt="">
        <span>uplod</span>
    </div>
</template>

<script setup lang="ts">
const props = defineProps<{}>();

const emits = defineEmits<{}>();


// 上传文件
function uploadFile() {

}
</script>

<style scoped lang="scss">
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
    font-weight: 500;
    line-height: var(--Line-Height-text-xs, 16px);
    /* 133.333% */
    cursor: pointer;

    .upload-icon {
        width: 16px;
        height: 16px;
    }
}
</style>
