<template>
  <BaseDialog :header="$t('偏好设置')" @hide="handleHide">
    <Tabs v-model:value="activeTab">
      <TabList>
        <template v-for="(tab) in tabs" :key="tab.id">
          <Tab :value="tab.id">{{ tab.label }}</Tab>
        </template>
      </TabList>
      <TabPanels v-if="isLoaded">
        <template v-for="(tab) in tabs" :key="tab.id">
          <TabPanel :value="tab.id">
            <component v-model="formData[tab.id]" :ref="(ins) => refs[tab.id] = ins" :is="tab.component" class="form-container" />
            <RxButton class="save-button" @click="tab.onSave">
              {{ $t('保存并生效') }}
            </RxButton>
          </TabPanel>
        </template>
      </TabPanels>
    </Tabs>
  </BaseDialog>
</template>

<script setup lang="ts">
import { preferenceSettings } from '../model';
import { savePreferenceSettings } from '../util';
import BaseDialog from './base-dialog.vue';
import CustomLayout from './preferences-components/custom-layout.vue';
import BaseSettings from './preferences-components/base-settings.vue'
import Simulate from './preferences-components/simulate.vue';
import KeyboardShortcut from './preferences-components/keyboard-shortcut.vue';
import { useResponseToast } from '/@/hooks/useResponseToast';
import { $t } from '/@/locales';
import { useUserStore } from '/@/stores/user';
import { merge } from 'es-toolkit';

const route = useRoute()
const { getUserConfig } = useUserStore()
const [showToast, onlyErrorToast] = useResponseToast()
const isLoaded = ref(false)

const refs = ref<Recordable>({})
const formData = ref(preferenceSettings)

const tabs = ref([
  {
    id: 'base',
    label: $t('基础设置'),
    component: markRaw(BaseSettings),
    onSave() {
      saveSettings()
    }
  },
  {
    id: 'customLayout',
    label: $t('自定义布局'),
    component: markRaw(CustomLayout),
    onSave() {
      console.log(formData.value);
      electronAPI.send('syncControl:doLayout', toRaw(formData.value.customLayout));
      saveSettings();
    }
  },
  {
    id: 'simulate',
    label: $t('仿真参数设置'),
    component: markRaw(Simulate),
    onSave: saveSettings
  },
  {
    id: 'shortcutKey',
    label: $t('快捷键设置'),
    component: markRaw(KeyboardShortcut),
    async onSave() {
      const isValid = refs.value.shortcutKey?.valid()

      if (!isValid) {
        onlyErrorToast(-1, $t('快捷键设置冲突'))
        return
      }

      const registerResult = await electronAPI.send('syncControl:registerShortcut', toRaw(formData.value.shortcutKey));
      console.log('registerResult', registerResult);
      saveSettings()
    }
  },
])

const defaultActiveTabId = tabs.value.find(tab => tab.id === route.query.tab)?.id || tabs.value[0].id
const activeTab = ref(defaultActiveTabId)

function handleHide() {
  electronAPI.send('syncControl:closePreferencesDialog')
}

function saveSettings() {
  setTimeout(async () => {
    const { code, msg } = await savePreferenceSettings(formData.value);
    console.log('saveSettings', formData.value)
    showToast(code, msg, { life: 1200 })
    electronAPI.send('syncControl:closePreferencesDialog')
  })
}

onMounted(async () => {
  const userSetting = await getUserConfig()
  if (userSetting?.preferenceSettings) {
    Object.keys(formData.value).forEach(key => {
      if (Reflect.has(userSetting.preferenceSettings!, key)) {
        merge(formData.value[key], userSetting.preferenceSettings![key])
      }
    })
  }
  isLoaded.value = true
  setTimeout(() => {
    const tablistEl = document.querySelector('.p-tablist')
    console.log('tablistEl scrollWidth', tablistEl?.scrollWidth, 'clientWidth', tablistEl?.clientWidth)
    electronAPI.send('app:resizeWindow', {
      width: window.innerWidth + tablistEl?.scrollWidth - tablistEl?.clientWidth,
      height: window.innerHeight
    })
  }, 60)
})
</script>

<style lang="scss">
.p-tablist {
  // overflow: auto hidden;
}

.form-container {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 16px;
  align-self: stretch;
}

.form-item {
  display: flex;
  align-items: center;
  gap: 16px;

  .form-item-label {
    color: var(--colors-text-text-primary, #fafafa);
    font-size: 14px;
    font-style: normal;
    font-weight: 400;
    line-height: 18px;

    &::after {
      content: ':';
    }
  }

  .form-item-content {
    align-self: flex-start;
  }
}

.save-button {
  position: fixed !important;
  bottom: 24px;
  left: 24px;
  right: 24px;
}

.p-tabpanels {
  margin-bottom: 48px;
}
</style>
