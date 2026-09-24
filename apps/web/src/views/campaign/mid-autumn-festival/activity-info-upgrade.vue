<script setup lang="ts">
import { getImage } from '/@/utils/basic'
import { useCampaignStore } from '/@/stores/campaign'

const { seasonalActivity } = storeToRefs(useCampaignStore())

const imgSrc = `url('${getImage('campaing/mid-autumn-festival/subscribe_banner_bg.jpg')}')`
</script>

<template>
  <div v-if="seasonalActivity.midAutumnFestival" class="relative flex flex-col justify-center gap-1.5 py-3.5 px-4 rounded-2 overflow-hidden banner">
    <div class="flex items-center gap-2">
      <div class="flex items-center gap-2">
        <img class="block size-6" :src="getImage('campaing/mid-autumn-festival/gift_box.svg')">
        <div class="title">
          {{ $t('升级会员 · 下单即抽奖') }}
        </div>
        <div class="rewards">
          {{ $t('100% 中奖') }}
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.banner {
  background-image: v-bind(imgSrc);
  background-size: auto 100%;
  background-position: top right;
  background-repeat: no-repeat;
}

.title {
  font-size: 18px;
  font-weight: 700;
  line-height: 120%;
  background: linear-gradient(180deg, #fbd99b 30.17%, #fcc67e 100%);
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.bouns {
  background: linear-gradient(180deg, #fbd99b 30.17%, #fcc67e 100%);
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.rewards {
  flex-shrink: 0;
  padding: 4px 10px;
  border-radius: 10000px;
  background: linear-gradient(90deg, #b5cefe 0%, #d0b4fc 100%);
  color: #272e3b;
  font-family: 'DingTalk JinBuTi';
  font-size: 14px;
  line-height: 140%;
}
</style>
