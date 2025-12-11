<script setup lang="ts">
import { $t } from '/@/locales'
import { isEmptyValue } from '/@/utils'
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

const stepList = ref<any[]>([
  {
    title: $t('嗨，欢迎加入！您的主要行业是？(可多选)'),
    name: 'source',
    options: [
      {
        label: $t('电商运营'),
        value: 'E-Commerce',
      },
      {
        label: $t('社交媒体'),
        value: 'Social Media',
      },
      {
        label: $t('广告营销'),
        value: 'Advertising Marketing',
      },
      {
        label: $t('SEO 优化'),
        value: 'SEO',
      },
      {
        label: $t('加密货币'),
        value: 'Crypto Trading',
      },
      {
        label: $t('数据爬取'),
        value: 'Web Scraping',
      },
    ].toSorted(() => Math.random() - 0.5).concat({ label: $t('其他'), value: 'Other' }),
  },
  {
    title: $t('您预计每月使用多少个浏览器窗口？'),
    type: 'single',
    name: 'plan',
    options: ['1-50', '50+', '100+', '500+', '1000+', '5000+', '10000+'].map(label => ({ label, value: label })),
  },
  {
    title: $t('您最看重的功能是？(可多选)'),
    name: 'feature',
    options: [
      {
        label: $t('环境隔离'),
        value: 'Profile Isolation',
      },
      {
        label: $t('代理管理'),
        value: 'Proxy Management',
      },
      {
        label: $t('团队协作'),
        value: 'Teamwork',
      },
      {
        label: $t('API 接口'),
        value: 'API',
      },
      {
        label: $t('自动化'),
        value: 'Automation',
      },
      {
        label: $t('数据同步'),
        value: 'Data Sync',
      },
    ].toSorted(() => Math.random() - 0.5),
  },
  {
    title: $t('您从哪里了解到我们？(可多选)'),
    name: 'about',
    options: [
      {
        label: $t('朋友推荐'),
        value: 'Friend Referral',
      },
      {
        label: $t('搜索引擎'),
        value: 'Search Engine',
      },
      {
        label: $t('社交媒体'),
        value: 'Social Media',
      },
      {
        label: $t('视频平台'),
        value: 'Video Platform',
      },
      {
        label: $t('论坛社区'),
        value: 'Forum & Community',
      },
    ].toSorted(() => Math.random() - 0.5).concat({ label: $t('其他'), value: 'Other' }),
  },
])

const page = ref(0)
const showVideo = ref(false)
const videoList = ref()

const bgSrc = computed(() => {
  return themeStore.realTheme === 'light' ? 'url("/images/information_bg.svg")' : 'url("/images/information_bg_dark.svg")'
})

function itemDisabled(group: any, item: any) {
  return group.type !== 'single' && !!group.limit && group.value?.length >= group.limit && !group.value?.includes(item.value)
}

function onClose() {
  emit('close')
}

async function handleNext() {
  if (page.value === stepList.value?.length - 1) {
    saveUserSurvey()
    await getVideoList()
    return
  }
  page.value = Math.min(page.value + 1, stepList.value?.length - 1)
}

function handlePrev() {
  page.value = Math.max(page.value - 1, 0)
}

function saveUserSurvey() {
  const datas = stepList.value.filter(item => !isEmptyValue(item.value)).map(item => [item.name, [].concat(item.value)])
  if (!datas.length) {
    return
  }
  API.base.userSubmitSurveyAnswerCreate(Object.fromEntries(datas))
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
              <div v-if="stepList[page].desc" class="mt-1.5 desc">
                {{ stepList[page].desc }}
              </div>
            </div>
            <div class="grid grid-cols-4 gap-4">
              <label v-for="item in stepList[page].options" :key="item.value" class="flex items-center justify-center text-center px-6 py-4 rounded-2 select-none item"
                     :class="{ disabled: itemDisabled(stepList[page], item), active: stepList[page].value?.includes(item.value) }" :for="item.value"
              >
                <RadioButton v-if="stepList[page].type === 'single'" v-model="stepList[page].value" class="!hidden" :input-id="item.value" :value="item.value" />
                <RxCheckbox v-else v-model="stepList[page].value" class="!hidden" :disabled="itemDisabled(stepList[page], item)" :input-id="item.value" :name="stepList[page].name"
                            :value="item.value"
                />
                {{ item.label }}
              </label>
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
                  {{ `${index + 1}`.padStart(2, '0') }}.
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
        <RxButton class="mx-auto ml-0" variant="text" severity="secondary" :label="$t('跳过')" @click="getVideoList" />
        <RxButton variant="outlined" severity="secondary" :label="$t('上一个')" @click="handlePrev" />
        <RxButton :label="$t('下一个')" :disabled="isEmptyValue(stepList[page].value)" @click="handleNext" />
      </template>
      <RxButton v-else :label="$t('完成')" @click="onClose" />
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
