<script setup lang="ts">
import { format } from 'date-fns'

// import { useUserStore } from '/@/stores/user'

// const { userPayInfo } = storeToRefs(useUserStore())
import { useCampaignStore } from '/@/stores/campaign'

interface SnowflakeData {
  id: number
  style: Record<string, string>
  svgStyle: Record<string, string>
}

const { currentActivity, seasonalActivity } = storeToRefs(useCampaignStore())

const animStyle = useCssModule('anim')

const count = 7
const snowflakes = ref<SnowflakeData[]>([])

const activityPeriod = computed(() => {
  const { start_timestamp, end_timestamp } = currentActivity.value
  return $t('活动时间: {start} - {end}', { start: format(start_timestamp, 'yyyy.MM.dd'), end: format(end_timestamp, 'yyyy.MM.dd') })
})

onMounted(() => {
  snowflakes.value = generateSnowflakes()
})

function generateSnowflakes() {
  const result: SnowflakeData[] = []

  for (let i = 0; i < count; i++) {
    // 透视逻辑核心
    // scale 0 (小/远) -> 1 (大/近)
    const scale = Math.random()

    // 1. 大小：15px 到 45px
    const size = 15 + scale * 30

    // 2. 透明度：0.3 到 0.9 (越小越透明)
    const opacity = 0.3 + scale * 0.6

    // 3. 下落时间：5秒 到 12秒 (越小越慢/时间越长)
    const durationFall = 12 - scale * 7

    // 4. 3D旋转速度：越大越慢
    const flipDuration = 1 + scale * 6

    // 其他属性保持随机
    const rightPos = Math.random() * 150
    const swayType = Math.floor(Math.random() * 3) + 1
    // 通过 CSS Module 获取真实的 keyframes 名称
    const swayName = animStyle[`sway-${swayType}`]
    const durationSway = 3 + Math.random() * 2

    // 5. 大幅增加延迟范围 (0-20秒)，确保完全错开
    const delay = Math.random() * 20

    result.push({
      id: i,
      style: {
        right: `${rightPos}px`,
        animationName: `${animStyle.fall}, ${swayName}`,
        animationDuration: `${durationFall}s, ${durationSway}s`,
        animationDelay: `-${delay}s, -${delay}s`,
        width: `${size}px`,
        height: `${size}px`,
        opacity: String(opacity),
        zIndex: String(Math.floor(scale * 10)),
      },
      svgStyle: {
        animationName: animStyle['flip-3d'] as string,
        animationDuration: `${flipDuration}s`,
      },
    })
  }

  return result
}
</script>

<template>
  <div v-if="seasonalActivity.newYear" class="relative pa-4 overflow-hidden content">
    <div class="flex flex-col gap-2">
      <div class="flex items-center">
        <div class="mr-3 radio" />
        <SvgIcon class="mr-1" name="other/tree" size="20" />
        <i18n-t class="title" tag="div" scope="global" :keypath="$t('{bold} 双旦活动大促', { bold: '{bold}' })">
          <template #bold>
            <span class="title-bold">RoxyBrowser</span>
          </template>
        </i18n-t>
      </div>
      <div class="pl-9 flex items-center gap-2">
        <i18n-t class="text" tag="div" scope="global" :keypath="$t('{holiday} 新用户额外 {discount}', { holiday: '{holiday}', discount: '{discount}' })">
          <template #holiday>
            <span class="text-bold">{{ $t('窗口订阅立享 8 折优惠') }}</span>
          </template>
          <template #discount>
            <span class="text-bold">{{ $t('再享 8 折优惠') }}</span>
          </template>
        </i18n-t>
        <SvgIcon name="other/gift" size="20" />
      </div>
      <div class="pl-9 period">
        {{ activityPeriod }}
      </div>
    </div>
    <div v-for="snowflake in snowflakes" :key="snowflake.id" class="snowflake" :style="snowflake.style">
      <SvgIcon :style="snowflake.svgStyle" name="other/snow_flake" color="#fff" size="60" />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.content {
  border-radius: 8px;
  background: radial-gradient(115.43% 78.22% at 50% 100%, #e50c00 0%, rgba(229, 12, 0, 0) 99.65%), #aa2424;
  perspective: 600px;
  perspective-origin: center center;
}

.snowflake {
  position: absolute;
  top: -60px;
  right: 0;
  left: auto;
  animation-timing-function: linear, ease-in-out;
  animation-iteration-count: infinite, infinite;
  will-change: transform, top;
  transform-style: preserve-3d;

  svg {
    width: 100%;
    height: 100%;
    display: block;
    filter: drop-shadow(0 0 2px rgba(255, 255, 255, 0.3));
    animation-timing-function: linear;
    animation-iteration-count: infinite;
  }
}

.radio {
  position: relative;
  width: 24px;
  height: 24px;
  border: 2px solid #fff;
  border-radius: 50%;

  &::before {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 12px;
    height: 12px;
    background: #fff;
    border-radius: 50%;
  }
}

.title {
  color: #fff;
  font-size: 12px;
  font-weight: 500;
  line-height: 16px;

  &-bold {
    font-family: Archivo;
    font-size: 12.698px;
    font-weight: 700;
  }
}

.text {
  color: #fff;
  font-size: 14px;
  line-height: 20px;

  &-bold {
    font-size: 20px;
    font-weight: 700;
    line-height: 24px;
  }
}

.period {
  color: #fff;
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;
  opacity: 0.8;
}
</style>

<style module="anim">
@keyframes fall {
  0% {
    top: -60px;
  }

  100% {
    top: 100%;
  }
}

@keyframes sway-1 {
  0%,
  100% {
    transform: translateX(0);
  }

  50% {
    transform: translateX(30px);
  }
}

@keyframes sway-2 {
  0%,
  100% {
    transform: translateX(0);
  }

  50% {
    transform: translateX(-30px);
  }
}

@keyframes sway-3 {
  0% {
    transform: translateX(0);
  }

  30% {
    transform: translateX(20px);
  }

  70% {
    transform: translateX(-20px);
  }

  100% {
    transform: translateX(0);
  }
}

@keyframes flip-3d {
  0% {
    transform: rotate3d(1, 1, 0, 0deg);
  }

  100% {
    transform: rotate3d(1, 1, 0, 360deg);
  }
}
</style>
