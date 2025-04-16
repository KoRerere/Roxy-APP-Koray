<script setup lang="tsx">
import PlanModal from '../pay/wallet/components/plan-success.vue'
import BalanceModal from '../pay/wallet/components/balance-success.vue'
import { useDialog } from '/@/hooks/useDialog'

const [dialogInstance] = useDialog()

function open1() {
  dialogInstance.showModal({
    showHeader: false,
    modal: true,
    blockScroll: true,
    innerDialog: true,
    pt: {
      content: '!pa-0'
    },
    slots: {
      container: () => <PlanModal />,
    },
  })
}

function open2() {
  dialogInstance.showModal({
    showHeader: false,
    modal: true,
    blockScroll: true,
    innerDialog: true,
    pt: {
      content: '!pa-0'
    },
    slots: {
      container: () => <BalanceModal />,
    },
  })
}

//=================================
import { motion, AnimatePresence } from 'motion-v'
import { $t } from '/@/locales'

const allIngredients = [
  { icon: "🍅", label: "Tomato" },
  { icon: "🥬", label: "Lettuce" },
  { icon: "🧀", label: "Cheese" },
  { icon: "🥕", label: "Carrot" },
  { icon: "🍌", label: "Banana" },
  { icon: "🥂", label: "Champers?" },
]

const [tomato, lettuce, cheese, carrot, banana, champers] = allIngredients
const tabs = [tomato, lettuce, cheese, carrot, banana, champers]

const selectedTab = ref(tabs[0])
//================================

const colums = [
  {
    title: $t('创建时间'),
    key: 'createTime',
    style: {
      width: '13%',
      minWidth: '140px',
    }
  },
  {
    title: $t('更新时间'),
    key: 'updateTime',
    style: {
      width: '13%',
      minWidth: '140px',
    }
  },
  {
    title: $t('最后打开'),
    key: 'openTime',
    style: {
      width: '13%',
      minWidth: '140px',
    }
  },
  {
    title: $t('其他'),
    key: 'actions',
    alignFrozen: 'right',
    slot: 'actions',
    style: {
      width: '0rem',
      minWidth: '120px',
    }
  },
]

const mannnnndata = Array.from({ length: 5 }, (_, index) => ({
  id: `${index}`,
  createTime: new Date(),
  updateTime: new Date(),
  openTime: new Date(),
  actions: 'actions',
}))

</script>

<template>
  <div class="relative back">
    <RxButton class="!w-20" @click="open1">plan</RxButton>
    <RxButton class="!w-20" @click="open2">blance</RxButton>
    <br>
    <br>
    <div class="flex gap-4">
      <div class="mannnnnnn" data-active="false"></div>
      <div class="mannnnnnn" data-active="true"></div>
    </div>
    <br>
    <RyTable selection-mode="multiple" :columns="colums" :data-list="mannnnndata" :show-table-header="false" :paginator="false" :show-actions="false" />

    <!-- <div class="container">
      <nav class="nav">
        <ul class="tabs-container">
          <motion.li v-for="item in tabs" :key="item.label" tag="li" class="tab" :initial="false" @click="selectedTab = item">
            {{ `${item.icon} ${item.label}` }}
            <motion.div v-if="item.label === selectedTab.label" class="underline" layout-id="underline" id="underline" />
          </motion.li>
        </ul>
      </nav>
      <main class="icon-container">
        <AnimatePresence mode="wait">
          <motion.div :key="selectedTab ? selectedTab.label : 'empty'" :initial="{ y: 10, opacity: 0 }" :animate="{ y: 0, opacity: 1 }" :exit="{ y: -10, opacity: 0 }" :transition="{ duration: 0.2 }"
            class="icon">
            {{ selectedTab ? selectedTab.icon : "😋" }}
          </motion.div>
        </AnimatePresence>
      </main>
    </div> -->
  </div>

</template>

<style lang="scss" scoped>
.mannnnnnn {
  width: 200px;
  height: 100px;
  background-color: skyblue;
  transition: all 0.5s;

  &:not([data-active="true"]):hover {
    background: orange;
  }

  &[data-active="true"] {
    background: yellowgreen;
  }
}

.container {
  width: 480px;
  height: 60vh;
  max-height: 360px;
  border-radius: 10px;
  background: white;
  overflow: hidden;
  box-shadow:
    0 1px 1px hsl(0deg 0% 0% / 0.075),
    0 2px 2px hsl(0deg 0% 0% / 0.075),
    0 4px 4px hsl(0deg 0% 0% / 0.075),
    0 8px 8px hsl(0deg 0% 0% / 0.075),
    0 16px 16px hsl(0deg 0% 0% / 0.075),
    0 2px 2px hsl(0deg 0% 0% / 0.075),
    0 4px 4px hsl(0deg 0% 0% / 0.075),
    0 8px 8px hsl(0deg 0% 0% / 0.075),
    0 16px 16px hsl(0deg 0% 0% / 0.075);
  display: flex;
  flex-direction: column;
}

.nav {
  background: #fdfdfd;
  padding: 5px 5px 0;
  border-radius: 10px;
  border-bottom-left-radius: 0;
  border-bottom-right-radius: 0;
  border-bottom: 1px solid #eeeeee;
  height: 44px;
}

.tabs-container {
  list-style: none;
  padding: 0;
  margin: 0;
  font-weight: 500;
  font-size: 14px;
  display: flex;
  width: 100%;
}

.tab {
  list-style: none;
  padding: 0;
  margin: 0;
  font-weight: 500;
  font-size: 14px;
  border-radius: 5px;
  border-bottom-left-radius: 0;
  border-bottom-right-radius: 0;
  width: 100%;
  padding: 10px 15px;
  position: relative;
  background: white;
  cursor: pointer;
  height: 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex: 1;
  min-width: 0;
  user-select: none;
  color: #0f1115;
}

.underline {
  position: absolute;
  bottom: -2px;
  left: 0;
  right: 0;
  height: 2px;
  background: orange;
}

.icon-container {
  display: flex;
  justify-content: center;
  align-items: center;
  flex: 1;
}

.icon {
  font-size: 128px;
}
</style>
