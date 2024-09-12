<template>
  <CustomDialog :visible="isShow" :closable="closable" :show-header="showHeader">
    <template #content>
      <div class="header-text">
        Upload Extension
      </div>
      <div class="text-sm">Select your extension</div>
      <div class="flex items-center justify-start gap-4">
        <Button @click="uploadFile('file')" outlined label="Upload" severity="info">
          <img src="/@/assets/images/extension/rx_ic_export.svg" alt="" />
          <span class="text-sm">Select a file</span>
        </Button> <span class="font-semibold">OR</span>
        <Button outlined label="Upload" severity="secondary">
          <img src="/@/assets/images/extension/rx_ic_folder.svg" alt="" />
          <span class="text-sm">Select a file</span>
        </Button>
      </div>

      <div class="flex items-center text-xs">
        <img src="/@/assets/images/extension/rx_ic_warn_fill.svg" class="mr-1" alt="">
        <span style="color: var(--Colors-Text-text-tertiary, #7C8387)">Zip, CRX file supported, file limited to 50MB
          max.</span>
      </div>

      <!-- 上传文件回显 -->
      <!--
      <div class="upload-file-info-box">

        <div class="upload-file-info-name">
          <div class="upload-file-info-icon">
            <img class="icon" src="" alt="">
          </div>
          <div class="upload-file-info-text">
            <div class="upload-file-info-name-size">
              <span class="upload-file-info-name-text">name</span>
              <span class="upload-file-info-name-size-text">10/50</span>
            </div>
            <InputText v-model="exNameInput" type="text" size="large" placeholder="Large" />
        </div>

        <div class="upload-file-info-desc">
          <div class="upload-file-info-desc-title">
            <div class="upload-file-info-desc-title-text">name</div>
            <div class="upload-file-info-desc-title-size">10/50</div>
          </div>
        </div>
      </div> -->
      <div class="text-xs tips" style="color: var(--Color-neutrals-600, #575D61);">
        * Please note that your extension should follow the <span class="tips-text-style">chrome extension <br />
          guideline</span> in order to
        install
        in our chrome kernel.
      </div>
    </template>
    <template #footer>
      <div class="footer-box">
        <Button label="Cancel" outlined @click="clickCancelBtn" />
        <Button label="Install" @click="clickInstallBtn" />
      </div>
    </template>
  </CustomDialog>
</template>

<script setup lang="ts">
const emits = defineEmits(['handleSubmitInstall', 'clickInstallCancelBtn']);
import { ref } from 'vue';
import CustomDialog from '/@/components/rx-dialog/index.vue';
import InputText from 'primevue/inputtext';
const closable = ref(false);
const installInputValue = ref();
const isShow = ref(false);
const showHeader = ref(false)
const exeInfo = ref();
const exNameInput = ref("222222222222222222222")
const props = defineProps({
  uploadPop: {
    type: Boolean,
    default: false
  }
})

watch(() => props.uploadPop, (newValue) => {
  isShow.value = newValue;
});


// 选择文件上次
async function uploadFile(selectType: 'dir' | 'file') {

  try {
    const res = await window.electronAPI.send('extension:getSelectedExtensionInfo', selectType)
    exeInfo.value = res.data
    const params = {
      ...res.data,
      source: "loacal"
    }
    // uploadLocalPlugin(params)
  }
  catch (error) {
    console.log('selectExtension error', error)
  }
}


// 点击install按钮
function clickInstallBtn() {
  emits('handleSubmitInstall', installInputValue.value)
}


// 点击取消按钮
function clickCancelBtn() {
  emits('clickInstallCancelBtn')
}



</script>

<style lang="scss" scoped>
.upload-dialog-box {
  margin-top: var(--spacing-4xl, 24px);
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--spacing-2xl, 16px);
  align-self: stretch;

  .header-text {
    color: #000;
    font-family: Inter;
    font-size: 14px;
    font-style: normal;
    font-weight: 600;
    line-height: normal;
  }


  .tips {
    color: var(--Color-neutrals-600, #575D61);
    font-family: Inter;
    font-size: 12px;
    font-style: normal;
    font-weight: 400;
    line-height: 18px;

    .tips-text-style {
      color: var(--Colors-Text-text-brand, #12A3FC);
      text-decoration-line: underline;
    }

    /* 150% */
  }

  .upload-file-info-box {
    display: flex;
    flex-direction: column;

    .upload-file-info-name {
      display: flex;
      height: 60px;
      align-items: flex-start;
      gap: var(--spacing-lg, 8px);
      align-self: stretch;


      .upload-file-info-icon {
        display: flex;
        padding: var(--spacing-xl, 12px);
        align-items: center;
        gap: 10px;
        border-radius: var(--radius-lg, 8px);
        border: 1px solid var(--Colors-Border-border-container, #C7CDD1);
        background: var(--Colors-Background-bg-body, #FFF);


      }
    }
  }

}


.footer-box {
  margin-top: var(--spacing-4xl, 24px);
}
</style>
