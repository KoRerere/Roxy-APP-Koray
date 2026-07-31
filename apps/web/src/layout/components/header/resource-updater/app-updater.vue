<script setup lang="ts">
import MotionArrow from '/@/layout/components/header/resource-updater/motion-arrow.vue'
import './rich-text/'
import { RxSvgIcon } from '/@/components/rx-icon/'
import { useConfirm } from 'primevue/useconfirm'
import { useSimpleLocale } from '/@/stores/locale'
import { useUserStore } from '/@/stores/user'
import { emitter } from '/@/utils/eventBus'
import type { ResourceUpdateMessage } from '@roxy/electron-preload'
import { useTutorialEntityLabels } from '/@/composables/useTutorialEntityLabels'

const { upgradeList } = defineProps<{
  upgradeList: ResourceUpdateMessage[]
}>()

const confirm = useConfirm()
const userStore = useUserStore()
const simpleLocale = useSimpleLocale()
const tutorialLabels = useTutorialEntityLabels()
const { getOfficialWebsite } = simpleLocale

const updateFeature = ref()
const updateSummary = ref()

function getLocalizedFeatureTips(newFeatureTips?: Record<string, any>) {
  const localFeature = newFeatureTips?.[simpleLocale.currentLocale]
  return localFeature?.[0]?.content
    ? localFeature.filter((item: { content?: string }) => item.content?.length)
    : []
}

function extractFeatureTitles(tipsList: Array<{ content: string }>): string[] {
  return tipsList
    .map((item) => {
      const div = document.createElement('div')
      div.innerHTML = item.content
      const h3 = div.querySelector('h3')
      const title = h3 ? plainTextFromElement(h3) : ''
      return title ? `${title}` : ''
    })
    .filter(Boolean)
}

watchEffect(() => {
  const appUpdate = upgradeList?.find(item => item.type === 'app')
  if (!appUpdate) {
    return
  }

  const tipsList = getLocalizedFeatureTips(appUpdate.newFeatureTips)
  const titles = extractFeatureTitles(tipsList)
  updateSummary.value = titles.length
    ? titles
    : [$t('最新版本已发布，请更新客户端以保持稳定性并享受最新功能。')]
})

function formatClientBtnLabel(item: ResourceUpdateMessage) {
  if (item.status === 'downloading') {
    return `${$t('正在下载')} ${Math.floor(item.percent!)}%`
  }
  else if (item.status === 'downloaded') {
    if (item.type === 'app') {
      return $t('重启并安装')
    }
    else if (item.type === 'web') {
      return $t('安装')
    }
  }
  else if (item.status === 'failed') {
    return $t('重试')
  }
  else {
    return $t('下载 v{version}', { version: item.version })
  }
}

function showAppUpdaterDialog(item: ResourceUpdateMessage) {
  if (item.status === 'downloading') {
    return $t('正在下载')
  }
  else if (item.status === 'downloaded') {
    confirm.require({
      message: tutorialLabels.value.closeAllEntitiesOnUpdate,
      header: $t('你确认要重启并安装新版本吗？'),
      rejectProps: {
        label: $t('取消'),
        severity: 'secondary',
        outlined: true,
      },
      acceptProps: {
        label: $t('重启'),
      },
      accept: () => {
        globalThis.electronAPI.send('app:quitAndInstall', item)
      },
    })
  }
  else if (item.status === 'failed') {
    globalThis.electronAPI.send('app:checkForUpdates')
  }
  else {
    // globalThis.electronAPI.send('app:download-update', info)
  }
}

async function handleClientItemClick(item: ResourceUpdateMessage) {
  const info = toRaw(item)
  console.log('handleItemClick', info)
  if (info.type === 'app') {
    showAppUpdaterDialog(info)
  }
  else if (info.type === 'web') {
    // props.updateWebFn()
  }
}

async function showLastUpdateLog() {
  updateFeature.value ??= await electronAPI.send('app:getLastUpdateFeature')
  const newFeatureTips = getLocalizedFeatureTips(updateFeature.value?.newFeatureTips)
  if (newFeatureTips.length) {
    emitter.emit('showAppUpgradeDialog', newFeatureTips)
  }
}

function normalizePlainText(text: string): string {
  return text
    .replace(/\u00A0/g, ' ')
    .replace(/[\n\r\t]+/g, ' ')
    .trim()
}

/** 抽取块内文案：忽略内部任意嵌套标签（如 strong），等价于取子树全部文本节点后拼接 */
function plainTextFromElement(el: Element): string {
  return normalizePlainText(el.textContent ?? '')
}
</script>

<template>
  <div class="flex flex-col items-start self-stretch gap-3 min-h-65">
    <template v-if="upgradeList.length">
      <template v-for="item in upgradeList" :key="item.releaseTime">
        <div v-if="item.type === 'app'" class="w-full flex flex-col items-center gap-5 pa-6 app">
          <div class="flex flex-col gap-2">
            <MotionArrow class="mx-auto" />
            <div class="tt-primary font-[JetBrains_Mono] font-700 text-center text-4 leading-5">
              v{{ userStore.appVersion }} -> v{{ item.version }}
            </div>
          </div>

          <div class="flex flex-col gap-3 w-full">
            <div class="tt-primary text-3.5 leading-5.5 font-600">
              {{ $t('Roxy浏览器 v{version} 现已发布', { version: item.version }) }}
            </div>
            <RxMaskScroll v-if="updateSummary?.length" class="max-h-30">
              <ul class="flex flex-col gap-1.5 ma-0 pa-0 pl-6">
                <li v-for="str in updateSummary" :key="str" class="break-all tt-secondary text-3.25 leading-4.5">
                  {{ str }}
                </li>
              </ul>
            </RxMaskScroll>
          </div>
          <RxButton v-if="item.status === 'downloaded'" class="w-full" size="md" icon="base/rx_ic_renew" :label="formatClientBtnLabel(item)" @click="handleClientItemClick(item)" />
          <RxButton v-else class="w-full" size="md" outlined severity="secondary" icon="base/rx_ic_download" :label="formatClientBtnLabel(item)" :loading="item.status === 'downloading'"
                    @click="handleClientItemClick(item)"
          />
        </div>
        <div v-if="item.type === 'web'" class="w-full flex items-start gap-2.5 px-4 py-3 patch">
          <RxSvgIcon class="flex-shrink-0" name="base/rx_ic_patch" color="var(--colors-icon-icon-brand)" />
          <div class="flex-1 flex flex-col gap-1">
            <div class="patch-title">
              {{ $t('v{version} 补丁', { version: item.version }) }}
            </div>
            <div class="patch-version">
              {{ $t('点击安装以应用更新补丁') }}
            </div>
          </div>
          <RxButton size="xxs" outlined severity="secondary" icon="base/rx_ic_refresh" :label="formatClientBtnLabel(item)" :loading="item.status === 'downloading'"
                    @click="handleClientItemClick(item)"
          />
        </div>
      </template>
    </template>
    <template v-else>
      <div class="client-no-data">
        <div class="box">
          <RxSvgIcon name="base/logo" class="w-12 h-12" />
          <div class="flex flex-col items-center gap-1 self-stretch">
            <div class="version">
              v{{ userStore.appVersion }}
            </div>
            <div class="text-center tips">
              {{ $t('您的客户端已是最新版本') }}
            </div>
          </div>
          <div class="flex items-center gap-3">
            <a class="log" href="#" @click.prevent="showLastUpdateLog">{{ $t('上次更新') }}</a>
            <span class="color-[var(--component-dropdown-divider)]">|</span>
            <a class="log" :href="getOfficialWebsite('/changelog')" target="_blank" rel="noopener noreferrer">{{ $t('更新日志') }}</a>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style lang="scss" scoped>
.patch {
  border-bottom: 1px solid var(--component-dropdown-divider, #e2e9ee);

  &-title {
    color: var(--colors-text-text-primary);
    font-size: 13px;
    font-weight: 600;
    line-height: 16px;
  }

  &-version {
    color: var(--colors-text-text-secondary);
    font-size: 12px;
    line-height: 16px;
  }
}

.client-no-data {
  display: flex;
  height: 270px;
  justify-content: center;
  align-items: center;
  align-self: stretch;

  .box {
    display: flex;
    width: 240px;
    flex-direction: column;
    align-items: center;
    gap: var(--spacing-2xl, 16px);
  }
}

.version {
  color: var(--colors-text-text-primary);
  font-family: 'JetBrains Mono';
  font-size: 14px;
  font-weight: 500;
}

.tips {
  color: var(--colors-text-text-secondary);
  font-size: 12px;
  font-weight: 500;
}

.log {
  color: var(--colors-text-text-inactive);
  text-align: center;
  font-family: Inter;
  font-size: 12px;
  font-style: normal;
  font-weight: 500;
  line-height: normal;
}
</style>
