<script setup lang="ts">
import TsFormInputText from '/@/views/lab/components/form/m-input-text.vue'
import { shuffle } from 'es-toolkit'

import { isEmptyValue } from '/@/utils'
import { useUserStore } from '/@/stores/user'
import { useThemeStore } from '/@/stores/theme'
import { useTutorialStore } from '/@/stores/tutorial'
import { API } from '/@/api'
import { AnimatePresence, motion } from 'motion-v'

const emit = defineEmits<{
  (e: 'close'): void
}>()

const router = useRouter()
const themeStore = useThemeStore()
const { getVideoMaps } = useTutorialStore()
const { mixpanelTrack } = useUserStore()

const stepList = ref<any[]>(shuffle([
  {
    title: $t('您所属的行业是？'),
    type: 'single',
    name: 'user_industry',
    options: shuffle([
      {
        label: $t('社媒'),
        value: 'Social Media',
      },
      {
        label: $t('爬虫'),
        value: 'Web Scraping',
      },
      {
        label: $t('电商'),
        value: 'E-Commerce',
      },
      {
        label: $t('广告'),
        value: 'Advertising Marketing',
      },
      {
        label: 'SEO',
        value: 'SEO',
      },
      {
        label: $t('加密货币'),
        value: 'Crypto Trading',
      },
    ]).concat({ label: $t('其他'), value: 'Other' }),
  },
  {
    title: $t('您预计使用几个浏览器环境/窗口？'),
    type: 'single',
    name: 'plan',
    options: [
      {
        label: $t('1 个'),
        value: '1',
      },
      {
        label: $t('10 个以内'),
        value: '1-10',
      },
      {
        label: $t('10 ~ 50个'),
        value: '10-50',
      },
      {
        label: $t('50 个以上'),
        value: '50+',
      },
      {
        label: $t('我不确定'),
        value: 'Unknown',
      },
    ],
  },
  {
    title: $t('您从哪里了解到我们？'),
    type: 'single',
    name: 'source',
    options: shuffle([
      {
        label: $t('朋友推荐'),
        value: 'Friend Referral',
      },
      {
        label: $t('搜索引擎'),
        value: 'Search Engine',
      },
      {
        label: $t('社媒/视频'),
        value: 'Media & Video',
      },
      {
        label: $t('论坛/社区'),
        value: 'Forum & Community',
      },
    ]).concat({ label: $t('其他'), value: 'Other' }),
  },
  {
    title: $t('您最在意哪一点？'),
    type: 'single',
    name: 'focus_on',
    options: [
      {
        label: $t('IP/网络纯净'),
        value: 'ip clean',
      },
      {
        label: $t('价格'),
        value: 'price',
      },
      {
        label: $t('多开稳定'),
        value: 'stable',
      },
      {
        label: $t('团队管理'),
        value: 'team',
      },
      {
        label: $t('自动化/智能'),
        value: 'automation',
      },
      {
        label: $t('隐私/安全'),
        value: 'privacy',
      },
    ],
  },
  {
    title: $t('您之前用的最多的指纹浏览器？'),
    type: 'single',
    name: 'used_product',
    options: shuffle([
      {
        label: 'AdsPower',
        value: 'adspower',
      },
      {
        label: $t('紫鸟'),
        value: 'ziniao',
      },
      {
        label: $t('比特'),
        value: 'bitbrowser',
      },
      {
        label: 'HubStudio',
        value: 'hubstudio',
      },
    ]).concat([{ label: $t('我都没用过'), value: 'None' }, { label: $t('其他'), value: 'Other' }]),
  },
]).slice(0, 3))

const page = ref(0)
const showVideo = ref(false)
const videoList = ref()

const bgSrc = computed(() => {
  return themeStore.realTheme === 'light' ? 'url("/images/information_bg.svg")' : 'url("/images/information_bg_dark.svg")'
})

const nextDisabled = computed(() => {
  if (stepList.value[page.value].value === 'Other') {
    return isEmptyValue(stepList.value[page.value].otherValue)
  }
  return isEmptyValue(stepList.value[page.value].value)
})

onMounted(() => {
  mixpanelTrack('welcome_page_view')
})

function itemDisabled(group: any, item: any) {
  return group.type !== 'single' && !!group.limit && group.value?.length >= group.limit && !group.value?.includes(item.value)
}

function radioValueChange(value: any) {
  if (value === 'Other') {
    return
  }
  handleNext()
}

function onClose() {
  emit('close')
}

async function handleSkip() {
  mixpanelTrack('welcome_skip_click')
  await getVideoList()
}

async function handleNext() {
  if (page.value === stepList.value.length - 1) {
    saveUserSurvey()
    await getVideoList()
    return
  }
  page.value = Math.min(page.value + 1, stepList.value.length - 1)
}

function handlePrev() {
  page.value = Math.max(page.value - 1, 0)
}

function saveUserSurvey() {
  const datas = stepList.value
    .filter(item => !isEmptyValue(item.value))
    .map((item) => {
      if (item.value === 'Other') {
        return [item.name, [`${item.value}_${item.otherValue}`]]
      }
      return [item.name, [item.value]]
    })

  if (!datas.length) {
    return
  }
  API.base.userSubmitSurveyAnswerCreate(Object.fromEntries(datas))
  mixpanelTrack('welcome_submit_success')
}

async function getVideoList() {
  const data = await getVideoMaps()
  if (!data) {
    onClose()
    return
  }
  showVideo.value = true
  videoList.value = Object.entries({
    create_profile: $t('创建您的第一个窗口'),
    bind_proxy: $t('导入一个代理 IP 至 Roxy'),
    invite_user_register: $t('邀请一位好友加入 Roxy'),
    context_menu: $t('通过鼠标右键便捷操作窗口'),
    manage_and_classify: $t('通过标签/项目区分管理窗口'),
    advanced_filter: $t('通过高级筛选快速定位窗口'),
    account_management: $t('导入、管理平台账号'),
    plugin_management: $t('通过扩展中心管理扩展应用'),
    synchronizer: $t('通过窗口同步简化重复操作'),
    team_management: $t('邀请成员 & 分配访问权限'),
  }).map(([key, title]) => ({ id: key, title, ...data[key as keyof typeof data] }))
}

function toTutorial(item: any) {
  router.push({ name: 'tutorial', query: { anchor: item.id } })
  onClose()
}
</script>

<template>
  <div class="w-240 py-6 welcome">
    <div class="flex items-center justify-between px-6">
      <div class="flex items-center gap-1.5">
        <SvgIcon name="base/logo" size="36" />
        <span class="welcome-logo">RoxyBrowser</span>
      </div>
      <div class="welcome-text">
        {{ $t('欢迎加入') }}
      </div>
    </div>
    <template v-if="!showVideo">
      <AnimatePresence mode="wait">
        <motion.div v-if="stepList[page]" :key="page" class="px-24" :initial="{ x: 50, opacity: 0 }" :animate="{ x: 0, opacity: 1 }" :exit="{ x: -50, opacity: 0 }" :transition="{ duration: 0.3 }">
          <div class="h-110 flex flex-col justify-center gap-6">
            <div>
              <div class="subtitle">
                {{ stepList[page].title }}
              </div>
              <div v-if="page === 0" class="mt-1.5 desc">
                {{ $t('欢迎使用！占用您几秒钟，让产品更贴合您的使用习惯！') }}
              </div>
            </div>
            <div class="grid grid-cols-4 gap-4">
              <label v-for="item in stepList[page].options" :key="item.value" class="flex items-center justify-center text-center px-6 py-4 rounded-2 select-none item"
                     :class="{ disabled: itemDisabled(stepList[page], item), active: stepList[page].value?.includes(item.value) }" :for="item.value"
              >
                <RadioButton v-if="stepList[page].type === 'single'" v-model="stepList[page].value" class="!hidden" :input-id="item.value" :value="item.value" @update:model-value="radioValueChange" />
                <RxCheckbox v-else v-model="stepList[page].value" class="!hidden" :disabled="itemDisabled(stepList[page], item)" :input-id="item.value" :name="stepList[page].name"
                            :value="item.value"
                />
                {{ item.label }}
              </label>
              <div v-if="stepList[page].value === 'Other'" class="col-span-4 flex flex-col gap-2">
                <div>{{ $t('其他') }}</div>
                <TsFormInputText v-model="stepList[page].otherValue" size="lg" :placeholder="stepList[page].title" />
              </div>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
      <div v-if="stepList.length > 1" class="w-full flex items-center gap-2 px-6">
        <div v-for="(_, index) in stepList" :key="index" class="flex-1 h-2 rounded-3 dot" :class="{ active: index <= page }" />
      </div>
    </template>

    <motion.div v-else-if="showVideo && videoList?.length > 0" :initial="{ y: -40, opacity: 0 }" :animate="{ y: 0, opacity: 1 }" :transition="{ duration: 0.4, ease: 'easeOut' }">
      <div class="h-110 flex flex-col justify-center gap-6">
        <motion.div :initial="{ y: -20, opacity: 0 }" :animate="{ y: 0, opacity: 1 }" :transition="{ duration: 0.35, delay: 0.1 }" class="px-14">
          <div class="subtitle">
            {{ $t('学习关于 RoxyBrowser 的一切') }}
          </div>
          <div class="mt-1.5 desc">
            {{ $t('在此之前，您可以学习一些简单的新手教程，助您快速掌握使用技巧！') }}
          </div>
        </motion.div>
        <motion.div :initial="{ y: -20, opacity: 0 }" :animate="{ y: 0, opacity: 1 }" :transition="{ duration: 0.35, delay: 0.2 }">
          <RxCarousel>
            <template #default="{ itemClass }">
              <div v-for="(item, index) in videoList" :key="item.title" :class="itemClass" class="flex flex-col gap-2.5 cursor-pointer first:pl-14 last:pr-14" @click="toTutorial(item)">
                <div class="pa-2.5 rounded-3 video-image">
                  <img class="block w-88 rounded-2" :src="item.coverImage">
                </div>
                <div class="px-3 video-title">
                  {{ `${Number(index) + 1}`.padStart(2, '0') }}.
                  {{ item.title }}
                </div>
              </div>
            </template>
          </RxCarousel>
        </motion.div>
      </div>
    </motion.div>

    <div class="mt-8 flex items-center justify-end gap-3 px-6">
      <template v-if="!showVideo">
        <RxButton class="mx-auto ml-0" variant="text" severity="secondary" :label="$t('跳过')" @click="handleSkip" />
        <RxButton variant="outlined" severity="secondary" :label="$t('上一个')" @click="handlePrev" />
        <RxButton :label="page === stepList.length - 1 ? $t('完成') : $t('下一个')" :disabled="nextDisabled" @click="handleNext" />
      </template>
      <RxButton v-else :label="$t('了解')" @click="onClose" />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.welcome {
  background-image: v-bind(bgSrc);
  background-repeat: no-repeat;
  background-position: center 0;

  &-logo {
    color: var(--colors-text-text-primary);
    font-family: Archivo;
    font-size: 18px;
    font-weight: 700;
    line-height: normal;
  }

  &-text {
    color: var(--colors-text-text-primary);
    font-size: 16px;
    font-weight: 600;
    line-height: normal;
  }
}

.subtitle {
  color: var(--colors-text-text-primary);
  font-size: 24px;
  font-weight: bold;
  line-height: normal;
}

.desc {
  color: var(--colors-text-text-tertiary);
  font-size: 14px;
  line-height: normal;
}

.item {
  border: 2px solid var(--colors-background-bg-page);
  box-shadow: inset 0px 0px 0px 1px var(--colors-border-border-action);
  color: var(--colors-text-text-primary);
  font-size: 14px;
  line-height: normal;
  cursor: pointer;

  &.active {
    font-weight: bold;
    color: var(--colors-text-text-brand);
    border-color: var(--colors-border-border-brand);
    background: var(--component-table-bg-selected);
    box-shadow: none;
  }

  &.disabled {
    border-color: var(--colors-border-border-inactive);
    color: var(--colors-text-text-inactive);
    cursor: not-allowed;
  }
}

.dot {
  background: var(--colors-background-bg-block);

  &.active {
    background: var(--colors-background-bg-brand);
  }
}

.video {
  &-image {
    background: var(--colors-background-bg-block);
  }

  &-title {
    color: var(--colors-text-text-secondary);
    font-size: 14px;
    font-weight: 500;
    line-height: normal;
  }
}
</style>
