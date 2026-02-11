<script setup lang="ts">
import TsFormInputText from '/@/views/lab/components/form/m-input-text.vue'
import { shuffle } from 'es-toolkit'
import { isEmptyValue } from '/@/utils'
import { useUserStore } from '/@/stores/user'
import { API } from '/@/api'
import { AnimatePresence, motion } from 'motion-v'

const { next } = defineProps<{
  next: () => void | Promise<void>
}>()

const { mixpanelTrack } = useUserStore()

const page = ref(0)

const surveyList = ref<any[]>(shuffle([
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

const nextDisabled = computed(() => {
  if (surveyList.value[page.value].value === 'Other') {
    return isEmptyValue(surveyList.value[page.value].otherValue)
  }
  return isEmptyValue(surveyList.value[page.value].value)
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

function handlePrev() {
  page.value = Math.max(page.value - 1, 0)
}

async function handleNext() {
  if (page.value === surveyList.value.length - 1) {
    saveUserSurvey()
    await next()
    return
  }
  page.value = Math.min(page.value + 1, surveyList.value.length - 1)
}

async function handleSkip() {
  mixpanelTrack('welcome_skip_click')
  await next()
}

function saveUserSurvey() {
  const datas = surveyList.value
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
</script>

<template>
  <div>
    <AnimatePresence mode="wait">
      <motion.div v-if="surveyList[page]" :key="page" class="px-24" :initial="{ x: 50, opacity: 0 }" :animate="{ x: 0, opacity: 1 }" :exit="{ x: -50, opacity: 0 }" :transition="{ duration: 0.3 }">
        <div class="h-110 flex flex-col justify-center gap-6">
          <div>
            <div class="subtitle">
              {{ surveyList[page].title }}
            </div>
            <div v-if="page === 0" class="mt-1.5 desc">
              {{ $t('欢迎使用！占用您几秒钟，让产品更贴合您的使用习惯！') }}
            </div>
          </div>
          <div class="grid grid-cols-4 gap-4">
            <label v-for="item in surveyList[page].options" :key="item.value" class="flex items-center justify-center text-center px-6 py-4 rounded-2 select-none item"
                   :class="{ disabled: itemDisabled(surveyList[page], item), active: surveyList[page].value?.includes(item.value) }" :for="item.value"
            >
              <RadioButton v-if="surveyList[page].type === 'single'" v-model="surveyList[page].value" class="!hidden" :input-id="item.value" :value="item.value"
                           @update:model-value="radioValueChange"
              />
              <RxCheckbox v-else v-model="surveyList[page].value" class="!hidden" :disabled="itemDisabled(surveyList[page], item)" :input-id="item.value" :name="surveyList[page].name"
                          :value="item.value"
              />
              {{ item.label }}
            </label>
            <div v-if="surveyList[page].value === 'Other'" class="col-span-4 flex flex-col gap-2">
              <div>{{ $t('其他') }}</div>
              <TsFormInputText v-model="surveyList[page].otherValue" size="lg" :placeholder="surveyList[page].title" />
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
    <div v-if="surveyList.length > 1" class="w-full flex items-center gap-2 px-6">
      <div v-for="(_, index) in surveyList" :key="index" class="flex-1 h-2 rounded-3 dot" :class="{ active: index <= page }" />
    </div>
    <div class="mt-8 flex items-center justify-end gap-3 px-6">
      <RxButton class="mx-auto ml-0" variant="text" severity="secondary" :label="$t('跳过')" @click="handleSkip" />
      <RxButton variant="outlined" severity="secondary" :label="$t('上一个')" @click="handlePrev" />
      <RxButton :label="page === surveyList.length - 1 ? $t('完成') : $t('下一个')" :disabled="nextDisabled" @click="handleNext" />
    </div>
  </div>
</template>

<style lang="scss" scoped>
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
