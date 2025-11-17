<script setup lang="ts">
import TsFormInputText from '/@/views/lab/components/form/m-input-text.vue'
import { RxAlert } from '/@/components/rx-alert'
import Fuse from 'fuse.js'
import { $t } from '/@/locales';
import { useWorkspaceStore } from '/@/stores/workspace';
import { useThemeStore } from '/@/stores/theme'

const { setCurrentWorkspace } = useWorkspaceStore()
const { currentWorkspace, sharedWorkspaceList } = storeToRefs(useWorkspaceStore())

const { realTheme } = storeToRefs(useThemeStore())

const activeKey = ref('all')

interface Tab {
  title: string
  value: string
  list: Item[]
}

interface Item {
  title: string
  description?: string
  image: string
  darkImage: string
  workspace?: any
}

const tabs = ref<Tab[]>([
  {
    title: $t('流媒体'),
    value: 'all',
    list: [
      {
        title: 'Netflix',
        image: '/images/campaing/platform/netflix-light.svg',
        darkImage: '/images/campaing/platform/netflix-dark.svg',
      },
      {
        title: 'Youtube Premium',
        image: '/images/campaing/platform/youtube-light.svg',
        darkImage: '/images/campaing/platform/youtube-dark.svg',
      },
      {
        title: 'Hulu',
        image: '/images/campaing/platform/hulu-light.svg',
        darkImage: '/images/campaing/platform/hulu-dark.svg',
      },
      // {
      //   title: 'Spotify',
      //   image: '/images/campaing/platform/spotify-light.svg',
      //   darkImage: '/images/campaing/platform/spotify-dark.svg',
      // },
      {
        title: 'Disney+',
        image: '/images/campaing/platform/disney-light.svg',
        darkImage: '/images/campaing/platform/disney-dark.svg',
      },
      {
        title: 'Prime Video',
        image: '/images/campaing/platform/prime-light.svg',
        darkImage: '/images/campaing/platform/prime-dark.svg',
      },
      {
        title: 'HBO max',
        image: '/images/campaing/platform/HBO-light.svg',
        darkImage: '/images/campaing/platform/HBO-dark.svg',
      },
    ]
  },
  {
    title: $t('AI/Codings'),
    value: 'available',
    list: [
      // {
      //   title: 'Cursor',
      //   image: '/images/campaing/platform/cursor-light.svg',
      //   darkImage: '/images/campaing/platform/cursor-dark.svg',
      // },
      {
        title: 'ChatGPT',
        image: '/images/campaing/platform/gpt-light.svg',
        darkImage: '/images/campaing/platform/gpt-dark.svg',
      },
      {
        title: 'Claude',
        image: '/images/campaing/platform/claude-light.svg',
        darkImage: '/images/campaing/platform/claude-dark.svg',
      },
      {
        title: 'Grok',
        image: '/images/campaing/platform/grok-light.svg',
        darkImage: '/images/campaing/platform/grok-dark.svg',
      },
      {
        title: 'Gemini',
        image: '/images/campaing/platform/gemini-light.svg',
        darkImage: '/images/campaing/platform/gemini-dark.svg',
      },
    ]
  },
])
const campaingMap = ref()

const banner = computed(() => ({
  bg: realTheme.value === 'dark' ? "url('/images/campaing/banner/banner-bg-dark.png')" : "url('/images/campaing/banner/banner-bg-light.png')",
  dots: realTheme.value === 'dark' ? "url('/images/campaing/banner/banner-dots-dark.png')" : "url('/images/campaing/banner/banner-dots-light.png')"
}))
const activeList = computed(() => tabs.value.find(tab => tab.value === activeKey.value)?.list || [])

const resultList = computed(() => search.value ? searchResult.value : activeList.value)

onMounted(() => {
  getCampaings()
})

async function getCampaings() {
  campaingMap.value = Object.fromEntries((sharedWorkspaceList.value || []).map(item => [item.workspaceName, item]))

  tabs.value.forEach(item => {
    const _list = item.list.map(item => {
      return {
        ...item,
        workspace: campaingMap.value[item.title],
      }
    })
    Reflect.set(item, 'list', _list)
  })

  initFuse()
}

function btnProps(item: any) {
  const isComingSoon = !item.workspace
  const isCurrent = currentWorkspace?.value?.id === item.workspace?.id

  return {
    disabled: isComingSoon || isCurrent,
    label: isCurrent ? $t('当前') : isComingSoon ? $t('即将推出') : $t('进入'),
    onClick: () => setCurrentWorkspace(item.workspace?.id)
  }
}

const fuse = ref()
const search = ref('')
const searchResult = ref()

function onSearch() {
  searchResult.value = fuse.value?.search(search.value).map((res: any) => toRaw(res.item))
}

function initFuse() {
  fuse.value = new Fuse(activeList.value, {
    threshold: 0.3,
    keys: ['title'],
  })
}

const bannerPlatforms = [
  {
    image: '/images/campaing/banner/netflix-light.png',
    darkImage: '/images/campaing/banner/netflix-dark.png',
    style: {
      width: '36px',
      height: '36px',
      transform: 'rotate(18deg)',
      left: '-35px',
      bottom: '77px',
    }
  },
  {
    image: '/images/campaing/banner/chatgpt-light.png',
    darkImage: '/images/campaing/banner/chatgpt-dark.png',
    style: {
      width: '44px',
      height: '44px',
      transform: 'rotate(10deg)',
      left: '-98px',
      bottom: '14px',
    }
  },
  {
    image: '/images/campaing/banner/spotify-light.png',
    darkImage: '/images/campaing/banner/spotify-dark.png',
    style: {
      width: '48px',
      height: '48px',
      transform: 'rotate(-5deg)',
      left: '-135px',
      bottom: '120px',
    }
  },
  {
    image: '/images/campaing/banner/prime-light.png',
    darkImage: '/images/campaing/banner/prime-dark.png',
    style: {
      width: '44px',
      height: '44px',
      transform: 'rotate(-15deg)',
      left: '-210px',
      bottom: '46px',
      border: 'none',
    }
  },
  {
    image: '/images/campaing/banner/gemini-light.png',
    darkImage: '/images/campaing/banner/gemini-dark.png',
    style: {
      width: '36px',
      height: '36px',
      transform: 'rotate(-24deg)',
      right: '-35px',
      bottom: '77px',
    }
  },
  {
    image: '/images/campaing/banner/claude-light.png',
    darkImage: '/images/campaing/banner/claude-dark.png',
    style: {
      width: '44px',
      height: '44px',
      transform: 'rotate(-5deg)',
      right: '-98px',
      bottom: '14px',
    }
  },
  {
    image: '/images/campaing/banner/youtube-light.png',
    darkImage: '/images/campaing/banner/youtube-dark.png',
    style: {
      width: '48px',
      height: '48px',
      transform: 'rotate(12deg)',
      right: '-135px',
      bottom: '120px',
    }
  },
  {
    image: '/images/campaing/banner/hulu-light.png',
    darkImage: '/images/campaing/banner/hulu-dark.png',
    style: {
      width: '44px',
      height: '44px',
      transform: 'rotate(12deg)',
      right: '-210px',
      bottom: '46px',
      border: 'none',
    }
  },
]

</script>

<template>
  <div class="flex flex-col h-full">
    <div class="h-75 flex items-end pb-10 banner">
      <div class="relative mx-auto flex flex-col items-center gap-6 z-3">
        <div class="title">{{ $t('Roxy 资源') }}</div>
        <div class="-mt-3 subtitle">{{ $t('使用 RoxyBrowser 共享有价值的付费资源') }}</div>
        <TsFormInputText class="!w-120" v-model="search" size="lg" icon="base/rx_ic_magnify" :placeholder="$t('搜索平台')" @input="onSearch"></TsFormInputText>
        <img draggable="false" v-for="item in bannerPlatforms" :key="item.image" :src="realTheme === 'dark' ? item.darkImage : item.image" class="absolute platform" :style="item.style">
      </div>
    </div>

    <div class=" mx-auto min-w-205 max-w-285 w-2/3 flex-1 flex flex-col gap-4 overflow-hidden">
      <RxTabs v-model:value="activeKey" :tabs="tabs" head-tabs only-tabs @update:value="initFuse"></RxTabs>
      <RxAlert class="!w-full" type="info" :title="$t('Roxy 资源现已免费提供给所有 RoxyBrowser 用户。')" :closable="false"></RxAlert>
      <div class="flex-1 grid content-start grid-cols-2 gap-6.5 pb-4 overflow-y-auto content " v-if="campaingMap">
        <div class="h-20 flex select-none item" :class="{ 'disabled': !item.workspace }" v-for="item in resultList">
          <div class="flex-1/4 flex items-center justify-center">
            <img draggable="false" :src="realTheme === 'dark' ? item.darkImage : item.image"></img>
          </div>
          <div class="flex-3/4 flex justify-between items-center px-4 gap-4">
            <div class="flex flex-col gap-1">
              <div class="item-title">{{ item.title }}</div>
              <div v-if="item.description" class="item-desc">{{ item.description }}</div>
            </div>
            <RxButton severity="secondary" variant="outlined" v-bind="btnProps(item)"></RxButton>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.banner {
  position: relative;

  &::before,
  &::after {
    content: '';
    position: absolute;
    inset: 0;
  }

  &::before {
    background-image: v-bind('banner.bg');
    background-size: cover;
    background-position: center;
    background-repeat: no-repeat;
  }

  &::after {
    background-image: v-bind('banner.dots');
    background-size: auto 112px;
    background-position: top center;
    background-repeat: no-repeat;
    mix-blend-mode: overlay;
  }
}

.content::-webkit-scrollbar {
  display: none;
}

.title {
  color: var(--colors-text-text-primary, #111213);
  font-family: Archivo;
  font-size: 24px;
  font-style: normal;
  font-weight: 700;
  line-height: normal;
}

.subtitle {
  color: var(--colors-text-text-tertiary, #575D60);
  font-family: Inter;
  font-size: 14px;
  font-style: normal;
  font-weight: 400;
  line-height: normal;
}

.item {
  border-radius: 8px;
  border: 1px solid var(--pattern-resources-border-card-active);
  background: var(--pattern-resources-bg-card-active);

  &-title {
    color: var(--colors-text-text-primary);
    font-size: 14px;
    font-weight: 700;
    line-height: normal;
  }

  &-desc {
    color: var(--colors-text-text-tertiary);
    font-size: 12px;
    line-height: normal;
  }
}

.disabled {
  border: 1px solid var(--pattern-resources-border-card-inactive);
  background: var(--pattern-resources-bg-card-inactive);
}

.platform {
  border-radius: 10px;
  border: 1px solid rgba(0, 0, 0, 0.08);
  box-shadow: 0 1px 4px 0 rgba(0, 0, 0, 0.04), 0 2px 8px 0 rgba(0, 0, 0, 0.04);
}
</style>
