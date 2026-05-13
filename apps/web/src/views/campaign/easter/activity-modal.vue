<script setup lang="ts">
import { useUserStore } from '/@/stores/user'
import { useSimpleLocale } from '/@/stores/locale'

const emit = defineEmits(['close', 'confirm'])

const { userPayInfo } = storeToRefs(useUserStore())
const { currentLocale } = storeToRefs(useSimpleLocale())
const { getOfficialWebsite } = useSimpleLocale()

const imageSrc = computed(() => {
  const suffix = ['zh-CN', 'en', 'ru'].includes(currentLocale.value!) ? currentLocale.value : 'zh-CN'
  return `/images/campaing/easter/cards_${suffix}.png`
})

const imageSrc2 = computed(() => {
  const suffix = ['zh-CN', 'en', 'ru'].includes(currentLocale.value!) ? currentLocale.value : 'zh-CN'
  return `/images/campaing/easter/cards1_${suffix}.png`
})

function onSubscribe() {
  emit('confirm')
  onClose()
}

function onWebsite() {
  window.open(getOfficialWebsite('/activity/easter'), '_blank')
  onClose()
}

function onClose() {
  emit('close')
}
</script>

<template>
  <div v-if="userPayInfo.isEaster" class="flex flex-col gap-1.5 select-none">
    <RxButton class="self-end" size="xxs" severity="secondary" icon="base/rx_ic_delete" :label="$t('关闭')" @click="onClose" />
    <div class="relative">
      <img draggable="false" class="block w-140 rounded-5" :src="imageSrc">

      <div class="absolute bottom-0 left-0 w-full flex flex-col items-end gap-8 pa-6 z-1">
        <div class="!min-w-32 px-6 h-10 flex items-center rounded-2 justify-center gap-2 cursor-pointer btn" @click="onSubscribe">
          <span>{{ $t('即刻订阅') }}</span>
          <SvgIcon name="base/rx_ic_arrow_right" />
        </div>
        <div class="w-full flex flex-col gap-2.5 pa-4 rounded-4 content">
          <div class="title">
            {{ $t('复活节彩蛋猎寻活动') }}
          </div>

          <i18n-t class="desc" tag="div" :keypath="$t('🐣 Roxy 浏览器复活节活动现已在官方网站上正式上线。 寻找那些隐藏的复活节彩蛋并领取您的奖励吧！先到先得。{link}', { link: '{link}' })" scope="global">
            <template #link>
              <a class="desc-link" :href="getOfficialWebsite('/activity/easter')" target="_blank" rel="noopener noreferrer">
                {{ $t('寻复活蛋') }}
              </a>
            </template>
          </i18n-t>
        </div>
      </div>
    </div>
  </div>

  <div v-if="userPayInfo.isEaster === false" class="flex flex-col gap-1.5 select-none">
    <RxButton class="self-end" size="xxs" severity="secondary" icon="base/rx_ic_delete" :label="$t('关闭')" @click="onClose" />
    <div class="relative">
      <img draggable="false" class="block w-140 rounded-5" :src="imageSrc2">

      <div class="absolute bottom-6 right-6 z-1 flex items-center justify-start gap-2.5">
        <div class="!min-w-32 px-6 h-10 flex items-center rounded-2 justify-center gap-2 cursor-pointer btn" @click="onWebsite">
          <span>{{ $t('寻复活蛋') }}</span>
          <SvgIcon name="base/rx_ic_arrow_right" />
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.btn {
  color: #fff;
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;
  background: linear-gradient(180deg, #fdba74 0%, #ff9220 100%);
  backdrop-filter: blur(4px);

  &:hover {
    border-radius: 8px;
    background: linear-gradient(180deg, #ffad56 0%, #ff880d 100%);
  }
}

.content {
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(20px);
}

.title {
  color: #fff;
  font-size: 16px;
  font-weight: 700;
  line-height: 24px;
}

.desc {
  color: rgba(255, 255, 255, 0.8);
  font-size: 14px;
  font-weight: 500;
  line-height: 21px;

  &-link {
    color: #ff970e;
    text-decoration-line: underline;
    text-decoration-style: solid;
    text-decoration-skip-ink: none;
    text-decoration-thickness: auto;
    text-underline-offset: auto;
    text-underline-position: from-font;
  }
}
</style>
