<script setup lang="ts">
import { API } from '/@/api'
import { motion } from 'motion-v'
import { genDefaultProfileByCount } from '/@/views/browser/create/form-inputs'
import { FirstGiftType } from '/@/enums/pay'

const { next } = defineProps<{
  next: (type?: FirstGiftType) => void | Promise<void>
}>()

const firstGift = ref()
const chooseType = ref()
const showGuide = ref(false)

const list = computed(() => {
  const { static: staticData, dynamic, discount } = firstGift.value
  return [
    {
      value: FirstGiftType.Static,
      img: staticData.imgUrl,
      text: [
        !!staticData.ispCount && $t('{ispCount} 条 {ispCountry} 静态住宅代理 IP', { ispCount: staticData.ispCount, ispCountry: staticData.ispCountry }),
        !!staticData.dcCount && $t('{dcCount} 条 {dcCountry} 静态机房代理 IP', { dcCount: staticData.dcCount, dcCountry: staticData.dcCountry }),
      ].join('\n+ '),
      desc: $t('有效期 {day} 天，由 Roxy 浏览器精选', { day: staticData.day }),
      visible: staticData.enable,
    },
    {
      value: FirstGiftType.Dynamic,
      img: dynamic.imgUrl,
      text: $t('动态住宅代理 IP 流量包\n(可设置任意国家地区 {value}MB)', { count: dynamic.count, value: dynamic.value }),
      desc: $t('有效时长 {day} 天，由 {sponsor} 赞助', { day: dynamic.day, sponsor: '{sponsor}' }),
      visible: dynamic.enable,
    },
    {
      value: FirstGiftType.Discount,
      img: discount.imgUrl,
      text: $t('Roxy 终身额外 {discount}% 折扣', { discount: discount.value }),
      desc: $t('可与现有优惠叠加使用'),
      visible: discount.enable,
    },
  ].filter(item => item.visible !== false)
})

onMounted(() => {
  getNewUserGift()
})

async function getNewUserGift() {
  try {
    const { code, data } = await API.base.userRegisterGiftConfigList()
    if (code !== 0 || !data?.enable) {
      // await next()
      showGuide.value = true
      return
    }
    firstGift.value = data
  }
  catch (error) {
    await next()
  }
}

async function onConfirm() {
  const chooseData = firstGift.value[chooseType.value]
  const windowIds = await genDefaultProfileByCount(chooseData.windowCount)
  await API.base.userRegGiftCreate({ windowIds, giftType: chooseType.value })

  await next(chooseType.value)
}
</script>

<template>
  <div>
    <div v-if="!firstGift && !showGuide" class="min-h-110" />
    <motion.div v-if="firstGift" :initial="{ y: -40, opacity: 0 }" :animate="{ y: 0, opacity: 1 }" :transition="{ duration: 0.4, ease: 'easeOut' }">
      <div class="h-110 flex flex-col justify-center gap-9 px-13.5">
        <div class="title">
          {{ $t('🎁 Roxy 浏览器为您准备了一份礼物，快选一个吧！') }}
        </div>
        <div class="flex gap-3.5">
          <div v-for="item in list" :key="item.value" class="flex-1 flex flex-col gap-2.5">
            <label :for="item.value" class="h-60 flex flex-col items-center justify-between pa-4 pb-12 rounded-3 cursor-pointer select-none item" :class="{ checked: chooseType === item.value }">
              <RadioButton v-model="chooseType" class="!hidden" :input-id="item.value" :value="item.value" name="choose" />
              <div class="relative w-6 h-6 self-start rounded-full shrink-0 radio" />
              <img :src="item.img" class="block w-24 h-24">
              <div class="whitespace-pre-wrap text-center text">
                {{ item.text }}
              </div>
            </label>
            <i18n-t class="pl-2 help" tag="div" :keypath="item.desc" scope="global">
              <template #sponsor>
                <span class="inline-flex items-center gap-1">
                  <a class="link" href="https://rola-ip.co" target="_blank">rola-ip.co</a>
                  <SvgIcon name="websites/rx_site_rolaip" size="12" />
                </span>
              </template>
            </i18n-t>
          </div>
        </div>
        <div v-if="chooseType" class="tt-secondary text-3.25 leading-4.5">
          {{ $t('本次发放的 IP 为限时体验资源，稳定性与网络质量为基础标准。如需长期、高质量的代理 IP，推荐您前往「代理 IP 商店」选购。') }}
        </div>
      </div>
    </motion.div>

    <motion.div v-if="showGuide" :initial="{ y: -40, opacity: 0 }" :animate="{ y: 0, opacity: 1 }" :transition="{ duration: 0.4, ease: 'easeOut' }">
      <div class="h-110 flex justify-center items-center gap-12">
        <video class="block w-100 rounded-md" autoplay muted loop playsinline>
          <source src="/video/tour-hide-guide.mp4" type="video/webm">
        </video>
        <div class="flex flex-col gap-2 w-90">
          <div class="title">
            {{ $t('快速上手 Roxy 浏览器') }}
          </div>
          <div class="desc">
            {{ $t('我们为您设计了从入门到精通的完整「新手教程」。无论是名词概念、快捷菜单还是个性化设置，所有内容均在侧边栏或右下角帮助中心随时可得。助力您充分发挥 Roxy 浏览器的功能价值。') }}
          </div>
        </div>
      </div>
    </motion.div>

    <div class="mt-8 flex items-center justify-end gap-3 px-6">
      <RxButton v-if="showGuide" :label="$t('开始使用')" @click="next()" />
      <RxButton v-else :label="$t('确认')" :disabled="!chooseType" @click="onConfirm" />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.title {
  color: var(--colors-text-text-primary);
  font-size: 24px;
  font-weight: 600;
  line-height: normal;
}

.desc {
  color: var(--colors-text-text-inactive);
  font-size: 14px;
  line-height: normal;
}

.item {
  border: 1px solid var(--colors-border-border-subtle);
  background: var(--colors-background-bg-action);

  &.checked {
    border-color: var(--campaign-giftcard-border-giftcard-select);

    .radio {
      border-color: var(--campaign-giftcard-border-giftcard-select);

      &::before {
        content: '';
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 12px;
        height: 12px;
        background: var(--campaign-giftcard-border-giftcard-select);
        border-radius: 50%;
      }
    }
  }
}

.radio {
  border: 2px solid var(--colors-border-border-subtle);
}

.text {
  color: var(--colors-text-text-primary);
  font-size: 16px;
  font-weight: 600;
  line-height: normal;
}

.help {
  color: var(--colors-text-text-inactive);
  font-size: 12px;
  line-height: normal;
}

.link {
  color: var(--colors-text-text-link);
}
</style>
