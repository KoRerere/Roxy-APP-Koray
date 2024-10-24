<script setup lang="ts">
import RxAvatar from '/@/components/rx-avatar.vue'
import { $t } from '/@/locales'

const inputs = reactive<any>([
  {
    type: 'text',
    label: 'Kernel',
    name: 'coreVersion',
    placeholder: `${$t('Please Enter The')} ${$t('Kernel')}`,
  },
  {
    type: 'number',
    label: 'number',
    name: 'coreVersion',
    placeholder: `${$t('Please Enter The')} ${$t('Kernel')}`,
  },
  {
    type: 'textarea',
    label: $t('User-Agent'),
    name: 'userAgent',
    icon: 'base/rx_ic_shuffle',
    iconClick: () => {
      console.log('🚀 ~ iconClick:')
    },
    change(input: any) {
      console.log('🚀 ~ change ~ input:', input)
    },
  },
  {
    type: 'radio',
    label: $t('language'),
    name: 'isLanguageBaseIp',
    options: [
      { label: $t('follow Ip'), value: true },
      { label: $t('custom'), value: false },
    ],
  },
  {
    label: $t('System'),
    type: 'select',
    placeholder: `${$t('Please Enter The')} ${$t('System')}`,
    name: 'osVersion',
    options: [
      { label: $t('follow Ip'), value: true },
      { label: $t('custom'), value: false },
    ],
  },
])

function onResize(size: any) {
  inputs.forEach((input: any) => {
    input.size = size
  })
}

const avatarList: any = [
  {
    avatar: 'https://primefaces.org/cdn/primevue/images/avatar/amyelsner.png',
  },
  {
    avatar: 'https://primefaces.org/cdn/primevue/images/avatar/annafali.png',
  },
  {
    // avatar: 'https://primefaces.org/cdn/primevue/images/avatar/asiyajavayant.png',
    name: 'DD',
    color: '#EDD666',
  },
  {
    avatar: 'https://primefaces.org/cdn/primevue/images/avatar/bernardodominic.png',
  },
  {
    avatar: 'https://primefaces.org/cdn/primevue/images/avatar/elwinsharvill.png',
  },
]
</script>

<template>
  <div class="h-full flex flex-col items-center justify-center overflow-hidden">
    <div class="flex items-end gap-4 mb-4">
      <!-- <RxButton severity="info" icon="base/rx_ic_package" size="lg" label="send email" @click="onResize('xxs')" /> -->
      <RxButton outlined icon="base/rx_ic_package" size="lg" label="send email" @click="onResize('xs')" />
      <!-- <RxButton severity="success" icon="base/rx_ic_package" size="lg" label="send email" @click="onResize('sm')" /> -->
      <!-- <RxButton severity="warn" icon="base/rx_ic_package" size="lg" label="send email" @click="onResize('md')" /> -->
      <!-- <RxButton severity="help" icon="base/rx_ic_package" size="lg" label="send email" @click="onResize('lg')" /> -->
      <!-- <RxButton severity="danger" icon="base/rx_ic_package" size="lg" label="send email" @click="onResize('lg')" /> -->
      <!-- <RxButton severity="contrast" icon="base/rx_ic_package" size="lg" label="send email" @click="onResize('lg')" /> -->
    </div>
    <!-- <RyForm label-position="left" :inputs="inputs" /> -->
  </div>
</template>

<style scoped></style>
