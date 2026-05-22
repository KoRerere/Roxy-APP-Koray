<script setup lang="ts">
import currency from 'currency.js'
import { API } from '/@/api'
import { getImage } from '/@/utils'
import { useThemeStore } from '/@/stores/theme'

const themeStore = useThemeStore()

const columns = ref([
  {
    title: $t('排名'),
    key: 'rank',
    slot: 'rank',
  },
  {
    title: $t('用户'),
    key: 'username',
    slot: 'user',
  },
  {
    title: $t('奖励'),
    key: 'bonusText',
    slot: 'bonus',
  },
])

const background = computed(() => themeStore.realTheme === 'dark'
  ? '/images/referral-program/rank-bg-dark.svg'
  : '/images/referral-program/rank-bg-light.svg')

async function tableRequest() {
  const { data } = await API.base.userGetInfluencerRankingList()
  return { data: { rows: data } }
}
</script>

<template>
  <div class="flex flex-col pa-2.5 pt-5 rounded-2 rank" :style="{ backgroundImage: `url(${background})` }">
    <div class="mb-4 flex flex-col items-center">
      <img draggable="false" class="w-16 aspect-square" :src="getImage('referral-program/trophy.svg')">

      <div class="mt-2 text-center tt-brand text-4.5 font-600 leading-7">
        {{ $t('推广达人排行榜') }}
      </div>
      <div class="text-center tt-tertiary text-3 font-500 leading-4">
        {{ $t('按本月已审核返利金额排序 · Top 10') }}
      </div>
    </div>
    <div class="flex-1 flex overflow-hidden">
      <RyTable class="rank-table" :columns="columns" :table-request="tableRequest" :paginator="false" :show-table-header="false" :show-actions="false">
        <template #rank="{ data }">
          <div>
            <img v-if="data.rank === 1" draggable="false" :src="getImage('referral-program/gold.svg')">
            <img v-if="data.rank === 2" draggable="false" :src="getImage('referral-program/silver.svg')">
            <img v-if="data.rank === 3" draggable="false" :src="getImage('referral-program/copper.svg')">
            <div v-if="data.rank > 3" class="w-6 h-6 relative justify-center items-center">
              <div class="color-[#111213] absolute top-1/2 left-1/2 -translate-1/2">
                {{ data.rank }}
              </div>
              <img draggable="false" :src="getImage('referral-program/number.svg')">
            </div>
          </div>
        </template>
        <template #user="{ data }">
          <div class="flex items-center gap-1">
            <div class="tt-primary text-3 font-500">
              {{ data.username }}
            </div>
          </div>
        </template>
        <template #bonus="{ data }">
          <div class="tt-brand">
            {{ currency(data.bonusText).format() }}
          </div>
        </template>
      </RyTable>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.rank {
  background-color: rgba(17, 163, 253, 0.1);
  background-position: top center;
  background-repeat: no-repeat;
}

.rank-table {
  :deep(td) {
    height: 48px !important;
  }
  :deep(.p-datatable-table) {
    padding-bottom: 0 !important;
  }
}
</style>
