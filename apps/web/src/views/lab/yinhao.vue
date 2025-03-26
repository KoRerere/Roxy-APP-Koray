<script setup lang="tsx">
import { Motion } from "motion-v";
import TierSlider from '../pay/subscribe/components/tier-slider.vue'
import { useDialog } from 'primevue/usedialog'
const dialog = useDialog()

import PlanModal from '../pay/wallet/components/plan-success.vue'
import BalanceModal from '../pay/wallet/components/balance-success.vue'


const tiers = [
  {
    "start": 0,
    "end": 10,
    "step": 10
  },
  {
    "start": 10,
    "end": 50,
    "step": 40
  },
  {
    "start": 50,
    "end": 100,
    "step": 50
  },
  {
    "start": 100,
    "end": 500,
    "step": 100
  },
  {
    "start": 500,
    "end": 1000,
    "step": 100
  }
]

const count = ref(0)

function open1() {
  dialog.open(PlanModal, {
    props: {
      showHeader: false,
      modal: true,
      blockScroll: true,
      pt: {
        root: '!bg-transparent !border-none !shadow-none',
        content: '!pa-20',
        mask: 'backdrop-blur-md'
      }
    },
    data: {
      props: {
      },
      onConfirm: async (params: any) => {

      },
    },
  })
}

function open2() {
  dialog.open(BalanceModal, {
    props: {
      showHeader: false,
      modal: true,
      blockScroll: true,
      pt: {
        root: '!bg-transparent !border-none !shadow-none',
        content: '!pa-20',
        mask: 'backdrop-blur-md'
      }
    },
    data: {
      props: {
      },
      onConfirm: async (params: any) => {

      },
    },
  })
}

const progress = ref(0.5)

//====================

const columns = ref([
  {
    title: 'aaa',
    key: 'aaa',
  },
  {
    title: 'bbb',
    key: 'bbb',
  },
  {
    title: 'ccc',
    key: 'ccc',
    props: {
      eye: false
    },
    headerSlot: 'mannnnnn',
    slot: 'mamba',
  },
])

const data = Array.from({ length: 10 }, (_, index) => ({
  aaa: index,
  bbb: index,
  ccc: index,
}))

</script>

<template>
  <div class="relative back">
    <RxButton class="!w-20" @click="open1">plan</RxButton>
    <RxButton class="!w-20" @click="open2">blance</RxButton>
    <div class="mt-20 mx-auto w-200">
      <TierSlider v-model="count" :tiers="tiers"></TierSlider>
    </div>
    <br>

    <!-- <div class="flex h-80 items-center justify-center Shiny">
      <div class="element">
        <Motion as="span" class="man-text" :style="{
          maskImage: 'linear-gradient(-75deg,hsl(202.82deg 97.5% 52.94%) calc(var(--x) + 20%),transparent calc(var(--x) + 30%),hsl(202.82deg 97.5% 52.94%) calc(var(--x) + 100%))'
        }" :animate="{ '--x': '-100%' }" :initial="{ '--x': '100%' }" :transition="{
          repeat: Infinity,
          repeatType: 'loop',
          repeatDelay: 1,
          type: 'spring',
          stiffness: 20,
          damping: 15,
          mass: 2
        }">
          Shiny Button
        </Motion>
        <Motion as="span" class="man-border" :style="{
          mask: 'linear-gradient(rgb(0,0,0), rgb(0,0,0)) content-box,linear-gradient(rgb(0,0,0), rgb(0,0,0))',
          maskComposite: 'exclude'
        }" :animate="{ '--x': '-100%' }" :initial="{ '--x': '100%' }" :transition="{
          repeat: Infinity,
          repeatType: 'loop',
          repeatDelay: 1,
          type: 'spring',
          stiffness: 20,
          damping: 15,
          mass: 2
        }"></Motion>
      </div>
    </div> -->


    <!-- <div class="mx-auto flex w-200 h-100 gap-20 overflow-hidden">
      <RyTable :columns="columns" :data-list="data" show-gridlines :showTableHeader="false" :paginator="false" :showActions="false">
        <template #mannnnnn="{ data }">
          <div class="flex items-center gap-2" @click="data.props.eye = !data.props.eye">
            <span>{{ data.title }}</span>
            <SvgIcon :name="data.props.eye ? 'base/rx_ic_eye' : 'base/rx_ic_hidden'"></SvgIcon>
          </div>
        </template>
<template #mamba="{ data, column }">
          <div v-if="column.props.eye">{{ data.ccc }}</div>
          <div v-else>{{ column }}</div>
        </template>
</RyTable>
</div> -->
  </div>
</template>

<style lang="scss" scoped>
.progress {
  &-value {
    fill: none;
    stroke-width: 4.5;
    stroke-dasharray: calc(2 * 3.14159 * 14);
    stroke: var(--stroke-color, #12A3FC);
    stroke-linecap: round;
    stroke-dashoffset: calc(2 * 3.14159 * 14 * var(--progress));
  }

  &-circle {
    transform: rotate(-90deg);
  }

  &-bg {
    fill: none;
    stroke: #E8F5FC;
    stroke-width: 4.5;
  }
}
</style>
