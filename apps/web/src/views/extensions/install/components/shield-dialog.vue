<script setup lang="ts">
import type { UnwrapRowType, UserGetPluginListListData } from '@roxy/backend-api';
import { $t } from '/@/locales';
import { RxSvgIcon } from '/@/components/rx-icon'
import { useToast } from 'primevue/usetoast';
import { RxAlert } from '/@/components/rx-alert/'

const props = defineProps<{
  extensionInfo: UnwrapRowType<UserGetPluginListListData>
}>()

/** 插件是否存在 */
const extensionExist = ref(false)

const toast = useToast()

const checkList = [
  {
    name: 'VirusTotal',
    icon: '/images/shield/virustotal.png',
    link: 'virustotal.com',
    desc: $t('由谷歌运营的知名在线病毒检测平台，被全球安全专家广泛信赖。')
  },
  {
    name: 'Metadefender',
    icon: '/images/shield/metadefender.png',
    link: 'metadefender.com',
    desc: $t('以多重扫描技术和恶意软件检测能力享誉业界，获国际安全机构认可。')
  },
  {
    name: 'Kaspersky',
    icon: '/images/shield/kaspersky.png',
    link: 'opentip.kaspersky.com',
    desc: $t('依托卡巴斯基在网络安全领域的深厚技术，提供实时恶意文件分析服务。')
  }
]

async function checkExtensionInfo() {
  try {
    const result = await electronAPI.send('extension:getExtensionInfo', props.extensionInfo.pluginDir!)
    console.log('checkExtensionInfo', result)
    extensionExist.value = true
  } catch (error) {
    console.error(`checkExtensionInfo error: ${error}`)
    extensionExist.value = false
    electronAPI.send('extension:download', [toRaw(props.extensionInfo)])
  }
}

function showExtensionDir() {
  electronAPI.send('extension:showExtensionDir', props.extensionInfo.pluginDir!)
}

const cancelListener = electronAPI.on('extension:download-progress', (payload) => {
  console.log('extension:download-progress', payload)

  if (payload.extID === props.extensionInfo.pluginDir) {
    extensionExist.value = payload.percent === 100
  }

  if (payload.errorTips) {
    toast.add({ severity: 'error', summary: payload.errorTips, life: 3000 });
  }
})

onBeforeUnmount(() => {
  cancelListener()
})

checkExtensionInfo()
</script>

<template>
  <div class="shield-dialog">
    <div class="extension-info">
      <div class="extension-info-icon">
        <img :src="extensionInfo.pluginIcon" alt="">
      </div>
      <div class="extension-info-content">
        <div class="extension-info-name">
          {{ extensionInfo.pluginName }}
        </div>
        <div class="extension-info-version">
          v{{ extensionInfo.pluginVersion }}
        </div>
      </div>
    </div>
    <RxAlert class="whitespace-pre-wrap w-full" :closable="false" type="info" :title="$t('RoxyBrowser 鼓励您自行通过权威机构检查扩展的安全性，以此来减少因使用恶意扩展而导致业务资产损失的担忧。\n\n您可以根据以下推荐步骤进行扩展安全性检查。')"></RxAlert>
    <div class="extension-info-step">
      <div class="extension-info-step-title">{{ $t('1. 点击下方按钮打开该扩展所在的本地文件夹') }}</div>
      <RxButton icon="base/rx_ic_folder" outlined :label="extensionExist ? $t('扩展文件夹') : $t('扩展加载中...')" :loading="!extensionExist" @click="showExtensionDir"> </RxButton>
    </div>
    <div class="extension-info-step">
      <div class="extension-info-step-title">{{ $t('2. 将文件上传至下列任意权威渠道进行安全性检查') }}</div>
      <div class="extension-info-step-list">
        <template v-for="item in checkList" :key="item.name">
          <div class="extension-info-step-item">
            <div class="extension-info-step-item-icon">
              <img :src="item.icon" alt="">
            </div>
            <div class="extension-info-step-item-content">
              <div class="extension-info-step-item-name">
                {{ item.name }}
                <a :href="`https://${item.link}`" target="_blank" class="extension-info-step-item-link">
                  <RxSvgIcon name="base/rx_ic_link" size="14px" /> {{ item.link }}
                </a>
              </div>
              <div class="extension-info-step-item-desc">
                {{ item.desc }}
              </div>
            </div>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>


<style lang="scss" scoped>
.shield-dialog {
  margin-top: 20px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--spacing-3xl, 20px);
}

.extension-info {
  display: flex;
  align-items: center;
  gap: 10px;
  align-self: stretch;

  .extension-info-icon {
    display: flex;
    padding: 8px;
    align-items: center;
    gap: 13.333px;
    border-radius: 8px;
    border: 1px solid var(--Colors-Border-border-container, #C7CDD1);
    background: var(--Colors-Background-bg-body, #FFF);

    img {
      display: flex;
      width: 32px;
      height: 32px;
      padding: 1.333px;
      justify-content: center;
      align-items: center;
    }
  }

  .extension-info-content {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: flex-start;
    gap: 4px;

    .extension-info-name {
      display: flex;
      align-items: center;
      gap: 4px;
      color: #000;
      font-family: Inter;
      font-size: 16px;
      font-style: normal;
      font-weight: 700;
      line-height: 19.2px;
    }

    .extension-info-version {
      color: var(--Colors-Text-text-tertiary, #7C8387);
      font-family: "JetBrains Mono";
      font-size: 14px;
      font-style: normal;
      font-weight: 400;
      line-height: 19.2px;
    }
  }
}

.extension-info-step {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: flex-start;
  gap: 6px;
  align-self: stretch;
}

.extension-info-step-title {
  color: var(--Colors-Text-text-primary, #171C1F);
  font-size: 14px;
  font-style: normal;
  font-weight: 400;
  line-height: 25.6px;
}

.extension-info-step-list {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: flex-start;
  gap: 16px;
  align-self: stretch;

  .extension-info-step-item {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    align-self: stretch;
  }

  .extension-info-step-item-icon {
    padding-top: 4px;

    img {
      width: 32px;
      height: 32px;
    }
  }

  .extension-info-step-item-content {
    display: flex;
    flex-direction: column;
    justify-content: center;
  }

  .extension-info-step-item-name {
    display: flex;
    align-items: center;
    color: #000;
    font-family: Inter;
    font-size: 14px;
    font-style: normal;
    font-weight: 600;
    line-height: 20px;
    gap: 8px;
  }

  .extension-info-step-item-link {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    color: var(--Colors-Text-text-link, #12A3FC);
    text-align: center;
    font-family: Inter;
    font-size: 12px;
    font-style: normal;
    font-weight: 400;
    line-height: 20px;
  }

  .extension-info-step-item-desc {
    color: var(--Colors-Text-text-tertiary, #7C8387);
    font-size: 12px;
    font-style: normal;
    font-weight: 400;
    line-height: 19.2px;
  }
}
</style>