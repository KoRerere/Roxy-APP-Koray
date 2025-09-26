<script setup lang="ts">
import { useTemplateRef } from 'vue'
import { RxAlert } from '/@/components/rx-alert'
import inputLabel from '/@/components/ry-form/input-label.vue'
import inputNumberGroup from '/@/components/ry-form/input-number-group.vue'
import RxInputSelect from '/@/components/ry-form/rx-input-select.vue'
import { getFormData, strConcat } from '/@/utils'
import { useCheckProxy } from '/@/views/agent/hooks'

const props = defineProps({
  inputs: {
    type: Array as PropType<any>,
    default: () => [],
  },
})

const { testProxy: checkProxy, checkResult, batchTestShowToast } = useCheckProxy()
const rxAlertRef = useTemplateRef('rxalert')
const original = defineModel<any>('original')

original.value = { ...toRaw(checkResult), ...original.value }

const visible = ref(false)

async function testProxy() {
  try {
    const data = getFormData(props.inputs)
    visible.value = false
    const result = await checkProxy(toRaw(data))
    batchTestShowToast([result])
    original.value = { ...original.value, ...result }

    if (!result.error) {
      visible.value = true
      nextTick(() => {
        rxAlertRef.value?.$el.scrollIntoView({ behavior: 'smooth' })
      })
    }
  }
  catch (error) {
    console.log(error)
  }
}

defineExpose({ testProxy, visible })

//=========================
import GuideModal from '/@/views/tutorial/components/guide-modal.vue';
import PlayVideo from '/@/views/tutorial/components/play-video.vue'
import { useUserStore } from "/@/stores/user";
import { useTutorialStore } from '/@/stores/tutorial';
import { useOnboardingTaskStatus } from '/@/views/tutorial/hooks.ts';
import { useDialog } from '/@/hooks/useDialog'
import { $t } from '/@/locales';

const { userPayInfo } = storeToRefs(useUserStore())
const { getVideoMaps } = useTutorialStore()
const { updateOnboardingTaskStatus } = useOnboardingTaskStatus()
const [showModal] = useDialog()

const videoData = ref()

onBeforeMount(() => {
  getVideoMaps()
    .then(data => {
      videoData.value = data?.proxy_management
    })
})

function onHideTips() {
  showModal({
    showHeader: false,
    modal: true,
    blockScroll: true,
    handleCancel: () => updateOnboardingTaskStatus({ createProxyVideoEntryStatus: true }),
    slots: {
      container: ({ hideModal }) => h(GuideModal, {
        title: $t('教程提示'),
        desc: $t('当您对 RoxyBrowser 的产品功能不熟悉或希望学习更多技巧时，可以随时通过右下方蓝色按钮找到"教程"入口。'),
        video: "/video/tour-hide-guide.mp4",
        onClose: hideModal,
        onConfirm: hideModal,
      })
    }
  })
}
</script>

<template>
  <div class="h-full w-full proxies-form">
    <PlayVideo v-if="videoData && !userPayInfo.onboardingTaskStatus?.createProxyVideoEntryStatus" :video-url="videoData?.videoUrl" :external-link="videoData?.externalLink" :autoplay="false">
      <template #default="{ onPlay }">
        <div class="flex items-center justify-start pa-3 gap-2.5 rounded-xl video" @click="onPlay">
          <div class="flex items-center pa-2 rounded-md video-icon">
            <SvgIcon name="base/rx_ic_play" color="var(--pattern-tutorial-video-bg-icon)"></SvgIcon>
          </div>
          <div class="flex-1 cursor-pointer">
            <div class="flex justify-between items-center">
              <span class="video-title">{{ $t('代理教程') }}</span>
              <SvgIcon class="cursor-pointer" name="base/rx_ic_delete" color="var(--colors-icon-icon-tertiary)" @click.stop="onHideTips"></SvgIcon>
            </div>
            <div class="video-desc">{{ $t('了解如何导入和配置代理 IP') }}</div>
          </div>
        </div>
      </template>
    </PlayVideo>
    <RyForm :inputs="inputs">
      <template #server="{ input }">
        <div class="flex flex-col">
          <inputLabel :label="input.label" />
          <div class="flex">
            <RxInputSelect v-bind="input.items[0]" v-model="input.items[0].value" class="!border-r-0 !rounded-tr-none !rounded-br-none" />
            <inputNumberGroup class="!rounded-tl-none !rounded-bl-none !shadow-none" :inputs="input.items" />
          </div>
        </div>
      </template>
      <template #ipchecker="{ input }">
        <div class="flex flex-col">
          <inputLabel v-bind="input" />
          <div class="flex gap-1.5">
            <div class="flex-1">
              <RxInputSelect v-bind="input.props" v-model="input.value" :name="input.name" />
            </div>
            <RxButton :size="input.props.size" outlined severity="secondary" :label="$t('测试代理')" icon="base/rx_ic_speed_test" @click="testProxy" />
          </div>
        </div>
      </template>
      <template #checkermessage>
        <RxAlert ref="rxalert" v-model:visible="visible" class="!w-full checkermessage" type="success" :title="$t('测试成功')" content="内容">
          <template #content>
            <i18n-t :keypath="$t('{location}{ip}{timezone}', { location: '{location}', timezone: '{timezone}', ip: '{ip}' })" scope="global">
              <template #location>
                <span>{{ $t('位置: {location}', {
                  location: `${checkResult.lastCountry}${strConcat('/',
                    checkResult.lastCity as string)}`
                }) }}</span>
              </template>
              <template #ip>
                <br><span>{{ $t('IP: {ip}', { ip: checkResult.lastIp }) }}</span>
              </template>
              <template #timezone>
                <br><span>{{ $t('时区: {timezone}', { timezone: checkResult.timezone }) }}</span>
              </template>
            </i18n-t>
          </template>
        </RxAlert>
      </template>
    </RyForm>
  </div>
</template>

<style lang="scss" scoped>
.video {
  background: linear-gradient(90deg, var(--pattern-tutorial-video-bg-start) 0%, var(--pattern-tutorial-video-bg-end) 100%);

  &-icon {
    background: var(--pattern-tutorial-video-bg-play);
  }

  &-title {
    color: var(--colors-text-text-primary);
    font-size: 13px;
    font-weight: 600;
    line-height: normal;
  }

  &-desc {
    color: var(--colors-text-text-secondary);
    font-size: 12px;
    line-height: normal;
  }
}

.proxies-form {
  overflow-y: auto;
  padding-bottom: 12px;

  &::-webkit-scrollbar {
    display: none;
  }

  :deep(.number-group-item) {
    &:first-of-type {
      flex: 2;
    }
  }
}
</style>
