<script setup lang="tsx">
import RxButton from '/@/components/rx-button'
import TaskCircle from '/@/views/tutorial/components/task-progress.vue'
import TutorialVideo from '/@/views/tutorial/components/tutorial-video.vue'
import { I18nT } from 'vue-i18n'

import { sleep } from '/@/utils'
import { useUserStore } from '/@/stores/user'
import { useTutorialStore } from '/@/stores/tutorial'
import { useSimpleLocale } from '/@/stores/locale'
import { useOnboardingTaskStatus } from '/@/views/tutorial/hooks.ts'
import type { UserGetGuideVideosByTypeListData } from '@roxy/backend-api'

interface BaseVideoItem {
  title: string
  descriptions: string[]
  render?: (props: { item: VideoItem }) => any
  [key: string]: any
}
type ApiVideoData = UserGetGuideVideosByTypeListData['data'][keyof UserGetGuideVideosByTypeListData['data']]
type VideoItem = BaseVideoItem & Partial<ApiVideoData>

const route = useRoute()
const router = useRouter()
const { mixpanelTrack } = useUserStore()
const { getVideoMaps } = useTutorialStore()
const { getOfficialFaqWebsite } = useSimpleLocale()
const { onboardingTaskStatus, updateOnboardingTaskStatus } = useOnboardingTaskStatus()

const cssModule = useCssModule()

const videoMap = ref<Record<string, VideoItem>>({
  create_profile: {
    id: 'create_profile',
    type: 'basic',
    get extraTask() {
      const complete = onboardingTaskStatus.value?.createProfileStatus
      return {
        icon: complete ? 'status/rx_ic_check_fill' : 'base/rx_ic_uncheck',
        complete,
      }
    },
    title: $t('任务 1: 创建您的第一个窗口'),
    descriptions: [$t('窗口是 RoxyBrowser 的核心功能，其各项设定与指纹决定了您在上网浏览时被平台检测到的"身份"，根据教程创建您的第一个窗口，从而开启隐私之旅！')],
    render: () => {
      return (
        <div class="flex flex-wrap justify-start gap-3">
          <RxButton variant="outlined" size="md" icon="base/rx_ic_browser_add" label={$t('前往创建')} onClick={() => router.push({ name: 'browser-create' })}></RxButton>
          <RxButton severity="secondary" variant="text" size="md" icon="base/rx_ic_doc_article" label={$t('窗口文档')} onClick={() => toFaqLink('/features/profile-configuration')}></RxButton>
        </div>
      )
    },
  },
  bind_proxy: {
    id: 'bind_proxy',
    type: 'basic',
    get extraTask() {
      const complete = onboardingTaskStatus.value?.createProxyStatus
      return {
        icon: complete ? 'status/rx_ic_check_fill' : 'base/rx_ic_uncheck',
        complete,
      }
    },
    title: $t('任务 2: 导入一个代理 IP 至 Roxy'),
    descriptions: [$t('代理 IP 是确保窗口安全性、匿名性的重要工具，其同时决定了部分指纹参数的生成，对您的"身份"真实性至关重要，根据教程导入您的代理 IP，从而不再因网络环境而被限制。')],
    render: () => {
      return (
        <div class="flex flex-wrap justify-start gap-3">
          <RxButton variant="outlined" size="md" icon="base/rx_ic_add_proxy" label={$t('前往配置')} onClick={() => router.push({ name: 'agent-create' })}></RxButton>
          <RxButton severity="secondary" variant="text" size="md" icon="base/rx_ic_doc_article" label={$t('代理 IP 文档')} onClick={() => toFaqLink('/features/proxies')}></RxButton>
        </div>
      )
    },
  },
  invite_user_register: {
    id: 'invite_user_register',
    type: 'basic',
    get extraTask() {
      const complete = onboardingTaskStatus.value?.inviteMemberStatus
      return {
        icon: complete ? 'status/rx_ic_check_fill' : 'base/rx_ic_uncheck',
        complete,
        reward: true,
      }
    },
    title: $t('任务 3: 邀请一位好友加入 Roxy'),
    descriptions: [$t('RoxyBrowser 支持用户自由地与好友分享窗口资源，无论是 1:1 的窗口转移功能，还是加入同一工作空间共享窗口，在这里都能轻松实现。')],
    reward: () => {
      return (
        <div class={cssModule.text}>
          <I18nT scope="global" keypath={$t('完成任务后，您可免费领取一个团队成员额度。')}></I18nT>
        </div>
      )
    },
    render: () => {
      return (
        <div class="flex flex-wrap justify-start gap-3">
          <RxButton variant="outlined" size="md" icon="base/rx_ic_user_add" label={$t('前往邀请')} onClick={() => router.push({ name: 'referral-program' })}></RxButton>
        </div>
      )
    },
  },
  context_menu: {
    id: 'context_menu',
    type: 'advanced',
    icon: 'base/rx_ic_mouse',
    title: $t('通过鼠标右键便捷操作窗口'),
    descriptions: [$t('绝大多数的 RoxyBrowser 列表允许您便捷地通过鼠标右键直接编辑，而无需寻找"更多操作"按钮。')],
    render: () => {
      return (
        <div class="flex flex-wrap justify-start gap-3">
          <RxButton
            variant="outlined"
            size="md"
            label={$t('前往尝试')}
            onClick={() => {
              router.push({ name: 'browser-list' })
              if (onboardingTaskStatus.value?.contextMenuGuideStatus === false) {
                updateOnboardingTaskStatus({ contextMenuGuideStatus: true })
              }
            }}
          >
          </RxButton>
        </div>
      )
    },
  },
  manage_and_classify: {
    id: 'manage_and_classify',
    type: 'advanced',
    icon: 'base/rx_ic_stack',
    title: $t('通过标签/项目区分管理窗口'),
    descriptions: [$t('当您的窗口数量较多时，可以为窗口设置标签或划分不同项目，从而更加高效地进行管理。')],
    render: () => {
      return (
        <div class="flex flex-wrap justify-start gap-3">
          <RxButton variant="outlined" size="md" label={$t('前往尝试')} onClick={() => router.push({ name: 'browser-list' })}></RxButton>
        </div>
      )
    },
  },
  advanced_filter: {
    id: 'advanced_filter',
    type: 'advanced',
    icon: 'base/rx_ic_filter_2',
    title: $t('通过高级筛选快速定位窗口'),
    descriptions: [$t('希望快速通过条件定位相应窗口？试试"高级筛选"功能，其亦可被保存为常驻"分组"！')],
    render: () => {
      return (
        <div class="flex flex-wrap justify-start gap-3">
          <RxButton
            variant="outlined"
            size="md"
            label={$t('前往尝试')}
            onClick={() => {
              router.push({ name: 'browser-list' })
              if (onboardingTaskStatus.value?.saveFilterGuideStatus === false) {
                updateOnboardingTaskStatus({ saveFilterGuideStatus: true })
              }
            }}
          >
          </RxButton>
        </div>
      )
    },
  },
  account_management: {
    id: 'account_management',
    type: 'advanced',
    icon: 'base/rx_ic_add_keys',
    title: $t('导入、管理平台账号'),
    descriptions: [$t('账号资源过多而难以管理？根据教程快速将其导入 RoxyBrowser，并更方便地与窗口进行绑定。')],
    render: () => {
      return (
        <div class="flex flex-wrap justify-start gap-3">
          <RxButton
            variant="outlined"
            size="md"
            label={$t('前往导入')}
            onClick={() => {
              router.push({ name: 'account-create', query: { anchor: 'account_management' } })
            }}
          >
          </RxButton>
          <RxButton severity="secondary" variant="text" size="md" icon="base/rx_ic_doc_article" label={$t('平台账号文档')} onClick={() => toFaqLink('/features/accounts')}></RxButton>
        </div>
      )
    },
  },
  // proxy_management: {
  //   id: 'proxy_management',
  //   type: 'advanced',
  //   icon: 'base/rx_ic_add_proxy',
  //   title: $t('导入、管理代理 IP'),
  //   descriptions: [$t('代理 IP 资源过多而担心重复利用？根据教程快速将其导入 RoxyBrowser，并更方便地进行管理。')],
  //   render: () => {
  //     return <div class="flex flex-wrap justify-start gap-3">
  //       <RxButton variant="outlined" size="md" icon="base/rx_ic_add_proxy" label={$t('前往导入')} onClick={() => {
  //         router.push({ name: 'agent-create', query: { anchor: 'proxy_management' } })
  //       }}></RxButton>
  //       <RxButton severity="secondary" variant="text" size="md" icon="base/rx_ic_doc_article" label={$t('代理 IP 文档')} onClick={() => toFaqLink('/features/proxies')}></RxButton>
  //     </div>
  //   }
  // },
  plugin_management: {
    id: 'plugin_management',
    type: 'advanced',
    icon: 'base/rx_ic_extension_store',
    title: $t('通过扩展中心管理扩展应用'),
    descriptions: [$t('浏览器扩展是高级用户不可或缺的助力工具，您可以添加/上传任何适用于常规 Chrome 的扩展程序到 RoxyBrowser。')],
    render: () => {
      return (
        <div class="flex flex-wrap justify-start gap-3">
          <RxButton variant="outlined" size="md" label={$t('前往添加')} onClick={() => router.push({ name: 'extensions' })}></RxButton>
          <RxButton severity="secondary" variant="text" size="md" icon="base/rx_ic_doc_article" label={$t('扩展文档')} onClick={() => toFaqLink('/features/extensions')}></RxButton>
        </div>
      )
    },
  },
  synchronizer: {
    id: 'synchronizer',
    type: 'advanced',
    icon: 'base/rx_ic_frame_stack',
    title: $t('通过窗口同步简化重复操作'),
    descriptions: [$t('窗口同步功能允许您同时控制多个环境，无论是多任务处理还是批量操作，都能轻松应对。')],
    render: () => {
      return (
        <div class="flex flex-wrap justify-start gap-3">
          <RxButton severity="secondary" variant="text" size="md" icon="base/rx_ic_doc_article" label={$t('窗口同步文档')} onClick={() => toFaqLink('/features/synchronizer')}></RxButton>
        </div>
      )
    },
  },
  team_management: {
    id: 'team_management',
    type: 'team',
    icon: 'base/rx_ic_user_add',
    title: $t('邀请成员 & 分配访问权限'),
    descriptions: [$t('RoxyBrowser 允许您邀请成员加入工作空间，并为其分配项目权限。')],
    render: () => {
      return (
        <div class="flex flex-wrap justify-start gap-3">
          <RxButton variant="outlined" size="md" label={$t('前往邀请')} onClick={() => router.push({ name: 'teams' })}></RxButton>
          <RxButton severity="secondary" variant="text" size="md" icon="base/rx_ic_doc_article" label={$t('团队文档')} onClick={() => toFaqLink('/features/team')}></RxButton>
        </div>
      )
    },
  },
})

const lightId = ref()
const timer = ref<NodeJS.Timeout>()
const list = computed(() => Object.values(videoMap.value))

const taskList = computed<any[]>(() => {
  const { basic, advanced, team } = Object.values(videoMap.value).reduce((acc, { type, id, title, extraTask }) => {
    acc[type as keyof typeof acc].push({ id, title, ...extraTask })
    return acc
  }, { basic: [], advanced: [], team: [] } as Record<string, any>)

  return [
    {
      title: $t('基础'),
      list: basic,
    },
    {
      title: $t('进阶'),
      list: advanced,
    },
    {
      title: $t('团队协作'),
      list: team,
    },
  ]
})

onBeforeMount(async () => {
  mixpanelTrack('tutorial_open')
  getVideoList()
  await sleep(100)
  nextTick(() => {
    if (route.query.anchor) {
      jumpToVideo({ id: route.query.anchor })
      router.replace({ name: 'tutorial' })
    }
  })
})

onUnmounted(() => {
  mixpanelTrack('tutorial_hide')
})

async function getVideoList() {
  const data = await getVideoMaps()
  if (!data)
    return
  Object.entries(data).forEach(([key, value]) => {
    const oldValue = Reflect.get(videoMap.value, key)
    if (oldValue) {
      Reflect.set(videoMap.value, key, { ...oldValue, ...value })
    }
  })
}

function toFaqLink(link: string) {
  window.open(getOfficialFaqWebsite(link), '_blank')
}

async function jumpToVideo(item: any) {
  clearTimeout(timer.value)
  const targetElement = document.getElementById(item.id)
  if (targetElement) {
    targetElement.scrollIntoView({ behavior: 'smooth' })
    lightId.value = item.id
    timer.value = setTimeout(() => {
      lightId.value = undefined
    }, 1000)
  }
}
</script>

<template>
  <div class="rx-container h-auto flex flex-col py-16 px-12 gap-12">
    <div class="flex flex-col gap-4.5">
      <div class="title">
        {{ $t('RoxyBrowser 与普通浏览器有何不同？') }}
      </div>
      <div class="flex items-start gap-24">
        <div class="min-w-110 flex-1 flex flex-col gap-4">
          <div class="desc">
            {{ $t('RoxyBrowser 是一款为用户提供完全独立环境的浏览器。') }}
          </div>
          <div class="desc">
            {{ $t('使用 RoxyBrowser，您就可以在一台电脑上安全地管理多个平台账号。在网站看来，每个账号都来自于一台完全不同的真实设备，从而避免了因账号关联产生的限制行为或隐私泄露。') }}
          </div>
          <div class="desc">
            {{ $t('可以将 RoxyBrowser 想象成谷歌浏览器的“终极强化版”。谷歌浏览器的多用户模式，如同为每个用户在一栋房子里分隔出不同的房间；而 RoxyBrowser 则是直接为每个用户都提供了一栋全新的、位于任意城市的、允许个性化装修的房子。') }}
          </div>
        </div>
        <img class="w-120" src="/images/guide-intro.png">
      </div>
    </div>
    <RxDivider line-only line-style="dashed" />
    <div class="flex relative gap-12">
      <div class="flex-1 flex flex-col">
        <template v-for="(item, index) in list" :key="item.title">
          <div :id="item.id" class="py-12 first:pt-0">
            <div :class="{ light: lightId === item.id }" class="flex flex-col gap-4.5 px-6 py-3 rounded-4 transition-all duration-300">
              <div class="flex items-start gap-8">
                <div class="flex-3/5 inline-flex items-start flex-col gap-5 pt-4">
                  <div class="flex items-center gap-3">
                    <SvgIcon v-if="item.extraTask" size="24" :name="item.extraTask.icon" color="var(--colors-border-border-subtle)" />
                    <SvgIcon v-else size="24" :name="item.icon" color="var(--pattern-tutorial-banner-theme2, #FF80F4)" />
                    <span class="title">{{ item.title }}</span>
                  </div>
                  <div v-if="item.reward" class="flex items-start py-1.5 px-2 gap-1.5 rounded reward">
                    <SvgIcon class="mt-0.75" name="base/rx_ic_gift" size="14" color="var(--colors-icon-icon-error)" />
                    <component :is="item.reward" :item="item" />
                  </div>
                  <div class="flex flex-col gap-4">
                    <div v-for="description in item.descriptions" :key="description" class="desc">
                      {{ description }}
                    </div>
                  </div>
                  <component :is="item.render" :item="item" />
                </div>
                <div class="flex-2/5 flex flex-col pa-2.5 gap-1 rounded-xl video">
                  <TutorialVideo :video-url="item.videoUrl" :external-link="item.externalLink" :autoplay="false">
                    <template #default="{ onPlay }">
                      <div class="relative rounded-lg cursor-pointer overflow-hidden" @click="onPlay">
                        <img class="block w-full" :src="item.coverImage">
                        <div class="absolute top-1/2 left-1/2 -translate-1/2 w-12 h-12 flex items-center justify-center rounded-full video-play">
                          <SvgIcon name="base/rx_ic_play" size="24" />
                        </div>
                      </div>
                    </template>
                  </TutorialVideo>
                  <div class="flex justify-end items-center gap-1">
                    <a class="video-external" :href="item.externalLink" target="_blank">{{ $t('Youtube 观看') }}</a>
                    <SvgIcon name="base/rx_ic_outlink" size="14" color="var(--colors-text-text-tertiary)" />
                  </div>
                </div>
              </div>
            </div>
          </div>
          <RxDivider v-if="index !== list.length - 1" line-only line-style="dashed" />
        </template>
      </div>
      <div class="sticky top-4 z-10 w-1/4 flex flex-col gap-4 self-start">
        <div class="flex items-center justify-between">
          <span class="task-header">{{ $t('教程进度') }}</span>
          <TaskCircle />
        </div>
        <RxDivider line-only line-style="dashed" />
        <template v-for="item in taskList" :key="item.title">
          <div class="task-title">
            {{ item.title }}
          </div>
          <div v-for="it in item.list" :key="it.text" class="flex items-center gap-2 cursor-pointer" @click="jumpToVideo(it)">
            <SvgIcon v-if="it.complete !== undefined" size="12" :name="it.complete ? 'base/rx_ic_check' : 'base/rx_ic_uncheck'"
                     :color="it.complete ? 'var(--colors-icon-icon-success)' : 'var(--colors-border-border-subtle)'"
            />
            <div class="task-text">
              {{ it.title }}
            </div>
            <SvgIcon v-if="it.reward" name="base/rx_ic_gift" size="14" color="var(--colors-icon-icon-error)" />
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<style module>
.text {
  color: var(--colors-text-text-warning-hover);
  font-size: 14px;
  line-height: 20px;
}
</style>

<style lang="scss" scoped>
.title {
  color: var(--colors-text-text-primary);
  font-family: Archivo;
  font-size: 20px;
  font-weight: 700;
  line-height: normal;
}

.reward {
  background: var(--colors-background-bg-warning);
}

.desc {
  color: var(--colors-text-text-secondary);
  font-size: 14px;
  line-height: 23px;
}

.video {
  background: var(--colors-background-bg-block);

  &-play {
    color: var(--colors-alpha-alpha-white-100);
    background: var(--colors-alpha-alpha-black-60, rgba(0, 0, 0, 0.6));
  }

  &-external {
    color: var(--colors-text-text-tertiary);
    font-size: 12px;
    line-height: 24px;
    text-decoration-line: underline;
    text-decoration-style: solid;
    text-decoration-skip-ink: auto;
    text-decoration-thickness: auto;
    text-underline-offset: auto;
    text-underline-position: from-font;

    &:hover {
      color: var(--colors-text-text-brand);
    }
  }
}

.task {
  &-header {
    color: var(--colors-text-text-primary);
    font-size: 14px;
    font-weight: 600;
    line-height: normal;
  }

  // &-link {
  //   color: var(--colors-text-text-link);
  //   font-size: 12px;
  //   font-weight: 600;
  //   line-height: normal;
  // }

  &-title {
    color: var(--colors-text-text-inactive);
    font-family: 'JetBrains Mono';
    font-size: 12px;
    font-weight: 500;
    line-height: normal;
    text-transform: uppercase;
  }

  &-text {
    color: var(--colors-text-text-primary);
    font-size: 12px;
    line-height: normal;
  }
}

.light {
  background-color: var(--component-table-bg-selected);
}
</style>
