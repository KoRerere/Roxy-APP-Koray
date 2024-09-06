<template>
  <CustomDialog :visible="isShow" :showHeader="showHeader" :closable="closable">
    <template #header>
      <div class="header-text">
        Install via Chrome Store
      </div>
    </template>
    <div class="install-url-box flex flex-col">
      <div class="text-xs tips mb-2">Please paste the chrome extension URL down below then click the install
        <br />button.
      </div>
      <InputText class="w-full mb-4" v-model="installInputValue" placeholder="Extension URL" />
    </div>

    <template #footer>
      <div class="flex justify-end">
        <Button type="button" @click="clickInstallBtn" label="Install"></Button>
        <Button @click="clickCancelBtn" severity="secondary" label="Cancel" class="ml-2" text></Button>
      </div>
    </template>
  </CustomDialog>
</template>

<script setup lang="ts">
const emits = defineEmits(['handleSubmitInstall', 'clickInstallCancelBtn']);
import { ref } from 'vue';
import CustomDialog from '/@/components/rx-dialog/index.vue';
const closable = ref(false);
const showHeader = ref(false);
const installInputValue = ref();
const isShow = ref(false);
const props = defineProps({
  isInstallPopVisible: {
    type: Boolean,
    default: false
  }
})


watch(() => props.isInstallPopVisible, (newValue) => {
  isShow.value = newValue;
});


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
.header-text {
  color: #000;
  font-family: Inter;
  font-size: 14px;
  font-style: normal;
  font-weight: 600;
  line-height: normal;
  margin-top: var(--spacing-4xl, 24px);
  
}

.install-url-box {
  margin-top: var(--spacing-xl, 12px);

  .tips {
    color: var(--Color-neutrals-600, #575D61);
    font-family: Inter;
    font-size: 12px;
    font-style: normal;
    font-weight: 400;
    line-height: 18px;
    /* 150% */
  }
}
</style>