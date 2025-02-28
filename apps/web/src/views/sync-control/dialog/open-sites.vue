<template>
  <BaseDialog :header="$t('打开网址')" @hide="handleHide">
    <div class="open-sites">
      <Textarea v-model="formData.urls" rows="8"
        :placeholder="$t('输入网址，多个网址通过换行区分: \nhttps://www.amazon.com \nhttps://www.facebook.com')" class="w-full" />
    </div>
    <div class="footer">
      <div class="flex items-center gap-2">
        <Checkbox v-model="formData.replaceCurrentTab" inputId="ingredient1" binary size="small" />
        <label for="ingredient1"> {{ $t('网址从当前标签页开始打开') }} </label>
      </div>
      <RxButton class="apply-button" @click="openSites">
        {{ $t('打开') }}
      </RxButton>
    </div>
  </BaseDialog>
</template>

<script setup lang="ts">
import BaseDialog from './base-dialog.vue';
import { $t } from '/@/locales';

const formData = ref({
  urls: '',
  replaceCurrentTab: false
});

function handleHide() {
  electronAPI.send('syncControl:closeOpenSitesDialog');
}

function openSites() {
  const params = {
    urls: formData.value.urls.split('\n').map(url => {
      const trimmedUrl = url.trim();
      if (!trimmedUrl) {
        return null;
      }
      // 如果不是 http 或 https 开头，则添加 http
      if (!trimmedUrl.startsWith('http://') && !trimmedUrl.startsWith('https://')) {
        return `http://${trimmedUrl}`;
      }
      return trimmedUrl
    }).filter(url => url),
    replaceCurrentTab: formData.value.replaceCurrentTab
  };
  console.log('openSites', params);
  electronAPI.send('syncControl:openSites', params);
}
</script>

<style lang="scss" scoped>
.open-sites {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 16px;
  align-self: stretch;

}

.footer {
  margin-top: 8px;
}


.apply-button {
  width: 100%;
  margin-top: 22px;
}
</style>
