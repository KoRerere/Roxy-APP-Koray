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
</script>

<template>
  <div class="relative back">
    <RxButton class="!w-20" @click="open1">plan</RxButton>
    <RxButton class="!w-20" @click="open2">blance</RxButton>
    <br>
    <br>
    <!-- ellipsis-1 -->
    <div class="table-cell whitespace-nowrap">
      <div class="whitespace-normal max-w-50 inline-flex items-center gap-2">
        <div class="w-10 h-10 bg-orange flex-shrink-0"></div>
        <div class="flex-1 note-content">mannnnnnmannnnnnmannnnnnmannnnnnmannnnnnmannnnnnmannnnnnmannnnnnmannnnnnmannnnnnmannnnnn</div>
      </div>
    </div>
    <br>
    <div class="container">
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
    </div>
  </div>

</template>

<style lang="scss" scoped>
.note-content {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  overflow: hidden;
  text-overflow: ellipsis;
  word-break: break-all;
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
