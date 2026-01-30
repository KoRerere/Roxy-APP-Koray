<script setup lang="ts">
import TsFormInputText from '/@/views/lab/components/form/m-input-text.vue'
import PayGift from '/@/views/tutorial/components/welcome-modal/pay-gift.vue'
import FirstGift from '/@/views/tutorial/components/welcome-modal/first-gift.vue'
import { shuffle } from 'es-toolkit'
import { isEmptyValue } from '/@/utils'
import { useUserStore } from '/@/stores/user'
import { useThemeStore } from '/@/stores/theme'
import { useCampaignStore } from '/@/stores/campaign'
import { API } from '/@/api'
import { AnimatePresence, motion } from 'motion-v'
import { genDefaultProfileByCount } from '/@/views/browser/create/form-inputs'
import { emitter } from '/@/utils/eventBus'

const emit = defineEmits<{
  (e: 'close'): void
}>()

const themeStore = useThemeStore()
const { mixpanelTrack } = useUserStore()
const { roxyGifts } = storeToRefs(useCampaignStore())
const { getRoxyGifts } = useCampaignStore()

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
        label: $t('1 ~ 2个'),
        value: '1-2',
      },
      {
        label: $t('2 ~ 5个'),
        value: '2-5',
      },
      {
        label: $t('5 ~ 20个'),
        value: '5-20',
      },
      {
        label: $t('20 个以上'),
        value: '20+',
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
const step = ref<'survey' | 'info' | 'new'>('survey')
const page = ref(0)
const firstGift = ref()
const chooseGift = ref()

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
  await getRoxyGiftsInfo()
}

async function handleNext() {
  if (page.value === stepList.value.length - 1) {
    saveUserSurvey()
    await getRoxyGiftsInfo()
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

async function getRoxyGiftsInfo() {
  try {
    await getRoxyGifts()
    if (!roxyGifts.value || roxyGifts.value.isValid === false) {
      await getNewUserGift()
      return
    }
    step.value = 'info'
  }
  catch (error) {
    onClose()
  }
}

async function getNewUserGift() {
  try {
    const { code, data } = await API.base.userRegisterGiftConfigList()
    if (code !== 0 || !data?.enable) {
      onClose()
      return
    }
    firstGift.value = data
    step.value = 'new'
  }
  catch (error) {
    onClose()
  }
}

async function onConfirm() {
  const windowIds = await genDefaultProfileByCount(firstGift.value.count)
  await API.base.userRegGiftCreate({ windowIds, giftType: chooseGift.value })

  emitter.emit('firstRegisterGuide')
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

    <template v-if="step === 'survey'">
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

    <motion.div v-else-if="step === 'info' && roxyGifts" :initial="{ y: -40, opacity: 0 }" :animate="{ y: 0, opacity: 1 }" :transition="{ duration: 0.4, ease: 'easeOut' }">
      <PayGift :roxy-gifts="roxyGifts" />
    </motion.div>

    <motion.div v-else-if="step === 'new' && firstGift" :initial="{ y: -40, opacity: 0 }" :animate="{ y: 0, opacity: 1 }" :transition="{ duration: 0.4, ease: 'easeOut' }">
      <FirstGift v-model="chooseGift" :data="firstGift" />
    </motion.div>

    <div class="mt-8 flex items-center justify-end gap-3 px-6">
      <template v-if="step === 'survey'">
        <RxButton class="mx-auto ml-0" variant="text" severity="secondary" :label="$t('跳过')" @click="handleSkip" />
        <RxButton variant="outlined" severity="secondary" :label="$t('上一个')" @click="handlePrev" />
        <RxButton :label="page === stepList.length - 1 ? $t('完成') : $t('下一个')" :disabled="nextDisabled" @click="handleNext" />
      </template>
      <RxButton v-else-if="step === 'info'" :label="$t('下一步')" @click="getNewUserGift" />
      <RxButton v-else :label="$t('确认')" :disabled="!chooseGift" @click="onConfirm" />
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
</style>
