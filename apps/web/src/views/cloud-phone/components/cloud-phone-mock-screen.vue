<script setup lang="ts">
/**
 * 云手机空状态背景里的示意手机屏幕（纯装饰，无真实品牌）
 * 消息 / 商城 / 短视频 / 地图 / 主屏幕 / 社交 / 个人主页 / 数据面板
 */
export type MockScreenType = 'chat' | 'shop' | 'video' | 'map' | 'home' | 'feed' | 'profile' | 'dash'

defineProps<{ type: MockScreenType }>()

const AVATARS = [
  ['#FDBA74', '#F97316'],
  ['#93C5FD', '#3B82F6'],
  ['#86EFAC', '#22C55E'],
  ['#C4B5FD', '#8B5CF6'],
  ['#FDA4AF', '#F43F5E'],
  ['#67E8F9', '#06B6D4'],
]
const PRODUCTS = ['#FDE68A,#F59E0B', '#BFDBFE,#60A5FA', '#FBCFE8,#EC4899', '#BBF7D0,#34D399']
const APP_ICONS = ['#F87171', '#FBBF24', '#34D399', '#60A5FA', '#A78BFA', '#F472B6', '#FB923C', '#2DD4BF', '#FFFFFF', '#818CF8', '#4ADE80', '#FACC15']
const STORIES = ['#F97316', '#EC4899', '#8B5CF6', '#06B6D4', '#22C55E']
const GALLERY = ['#FCA5A5', '#93C5FD', '#86EFAC', '#FDE68A', '#C4B5FD', '#F9A8D4', '#67E8F9', '#FDBA74', '#A5B4FC']
const STATS = ['#22C55E', '#F59E0B', '#3D8EF7', '#EF4444']
</script>

<template>
  <div class="mock relative h-full w-full overflow-hidden">
    <!-- 消息 -->
    <template v-if="type === 'chat'">
      <div class="h-2" />
      <div class="mock__title px-2 pb-1.5 pt-1">
        Messages
      </div>
      <div v-for="(c, i) in AVATARS" :key="i" class="flex items-center gap-1.25 px-2 py-1">
        <div class="size-4 shrink-0 rounded-full" :style="{ background: `linear-gradient(135deg,${c[0]},${c[1]})` }" />
        <div class="flex-1">
          <div class="mock__sk mock__sk--strong mb-0.75 h-1 w-[60%]" />
          <div class="mock__sk h-0.75 w-[85%]" />
        </div>
      </div>
    </template>

    <!-- 商城 -->
    <template v-else-if="type === 'shop'">
      <div class="h-2" />
      <div class="mock__sk mx-1.75 mb-1.5 mt-0.5 h-3 rounded-full" />
      <div class="grid grid-cols-2 gap-1.25 px-1.75">
        <div v-for="(g, i) in PRODUCTS" :key="i">
          <div class="h-12 rounded-1.25" :style="{ background: `linear-gradient(140deg,${g})` }" />
          <div class="mock__sk mt-1 h-0.75 w-[80%]" />
          <div class="mt-0.75 h-1 w-[40%] rounded-0.5 bg-[#F87171]" />
        </div>
      </div>
    </template>

    <!-- 短视频 -->
    <template v-else-if="type === 'video'">
      <div class="absolute inset-0 bg-[linear-gradient(170deg,#1E3A8A_0%,#7C3AED_55%,#F472B6_100%)]" />
      <div class="absolute inset-0 bg-[radial-gradient(circle_at_30%_40%,rgba(255,255,255,.35),transparent_45%)]" />
      <div class="absolute bottom-10 right-1.75 flex flex-col gap-2">
        <div v-for="i in 3" :key="i" class="size-3 rounded-full bg-white/85" />
      </div>
      <div class="absolute bottom-3.5 left-2 w-[60%]">
        <div class="mb-1 h-1 w-[55%] rounded-0.5 bg-white/90" />
        <div class="h-0.75 rounded-0.5 bg-white/60" />
      </div>
    </template>

    <!-- 地图 -->
    <template v-else-if="type === 'map'">
      <div class="absolute inset-0 bg-[#EAF2E3]" />
      <svg class="absolute inset-0 h-full w-full" viewBox="0 0 100 210" preserveAspectRatio="none">
        <path d="M-5 60 Q40 80 60 40 T110 30" stroke="#fff" stroke-width="7" fill="none" />
        <path d="M20 215 Q30 120 105 110" stroke="#fff" stroke-width="5" fill="none" />
        <path d="M-5 150 L110 170" stroke="#FCD34D" stroke-width="4" fill="none" />
        <rect x="58" y="130" width="30" height="22" rx="3" fill="#CFE3F7" />
        <rect x="8" y="85" width="22" height="30" rx="3" fill="#D6E7C8" />
      </svg>
      <div class="mock__pin absolute left-[44%] top-[40%] size-3.5 border-2 border-white border-solid bg-[#3D8EF7]" />
      <div class="absolute bottom-2 left-1.5 right-1.5 h-7.5 rounded-1.75 bg-white p-1.5 shadow-[0_2px_6px_rgba(0,0,0,.1)]">
        <div class="mb-1 h-1 w-[60%] rounded-0.75 bg-[#DDE2E8]" />
        <div class="h-0.75 w-[40%] rounded-0.75 bg-[#EEF1F5]" />
      </div>
    </template>

    <!-- 主屏幕 -->
    <template v-else-if="type === 'home'">
      <div class="absolute inset-0 bg-[linear-gradient(160deg,#BAE6FD,#A5B4FC_60%,#F0ABFC)]" />
      <div class="relative grid grid-cols-4 gap-x-1.5 gap-y-2.25 px-2.25 pt-6.5">
        <div v-for="(c, i) in APP_ICONS" :key="i" class="aspect-square rounded-1.25 shadow-[0_1px_2px_rgba(0,0,0,.08)]" :style="{ background: c }" />
      </div>
      <div class="absolute bottom-2 left-2 right-2 h-5.5 flex items-center justify-around rounded-2 bg-white/45">
        <div v-for="i in 4" :key="i" class="size-3.25 rounded-1 bg-white" />
      </div>
    </template>

    <!-- 社交动态 -->
    <template v-else-if="type === 'feed'">
      <div class="h-2" />
      <div class="flex gap-1.25 px-1.75 pb-1.5 pt-0.5">
        <div v-for="(c, i) in STORIES" :key="i" class="size-3.5 rounded-full p-px" :style="{ border: `1.5px solid ${c}` }">
          <div class="mock__sk h-full w-full rounded-full" />
        </div>
      </div>
      <div class="flex items-center gap-1 px-1.75 pb-1">
        <div class="size-2.5 rounded-full bg-[#CBD5E1]" />
        <div class="mock__sk h-0.75 w-7.5" />
      </div>
      <div class="h-23 bg-[linear-gradient(150deg,#FDE68A,#FB923C_50%,#DB2777)]" />
      <div class="flex gap-1.25 px-1.75 py-1.25">
        <div v-for="i in 3" :key="i" class="mock__sk size-2.25 rounded-0.75" />
      </div>
      <div class="mock__sk mx-1.75 h-0.75 w-[70%]" />
    </template>

    <!-- 个人主页 -->
    <template v-else-if="type === 'profile'">
      <div class="h-14.5 bg-[linear-gradient(135deg,#60A5FA,#3D8EF7)]" />
      <div class="mock__avatar mx-auto mb-1.25 -mt-3.75 size-7.5 rounded-full bg-[linear-gradient(135deg,#FDE68A,#F59E0B)]" />
      <div class="mock__sk mock__sk--strong mx-auto mb-1 h-1 w-[40%]" />
      <div class="mock__sk mx-auto mb-2 h-0.75 w-[28%]" />
      <div class="grid grid-cols-3 gap-0.5 px-1">
        <div v-for="(c, i) in GALLERY" :key="i" class="aspect-square opacity-85" :style="{ background: c }" />
      </div>
    </template>

    <!-- 数据面板 -->
    <template v-else>
      <div class="h-2" />
      <div class="px-2 pt-0.5">
        <div class="mock__sk mb-1 h-0.75 w-[35%]" />
        <div class="mock__title mb-1.5 text-3">
          $12,480
        </div>
        <svg class="block w-full" height="40" viewBox="0 0 80 40" preserveAspectRatio="none">
          <path d="M0 34 L12 28 L24 30 L36 18 L48 22 L60 10 L72 14 L80 6 V40 H0Z" fill="#3D8EF7" opacity=".12" />
          <path d="M0 34 L12 28 L24 30 L36 18 L48 22 L60 10 L72 14 L80 6" stroke="#3D8EF7" stroke-width="2" fill="none" vector-effect="non-scaling-stroke" />
        </svg>
      </div>
      <div v-for="(c, i) in STATS" :key="i" class="flex items-center gap-1.25 px-2 py-1.25">
        <div class="size-3 rounded-1 opacity-20" :style="{ background: c }" />
        <div class="mock__sk h-0.75 flex-1" />
        <div class="h-0.75 w-3.5 rounded-0.5" :style="{ background: c }" />
      </div>
    </template>
  </div>
</template>

<style scoped>
.mock {
  background: var(--colors-background-bg-page);
}

.mock__title {
  font-size: 8px;
  font-weight: 600;
  line-height: 1.2;
  color: var(--colors-text-text-primary);
}

.mock__sk {
  border-radius: 3px;
  background: color-mix(in srgb, var(--colors-text-text-primary) 7%, transparent);
}

.mock__sk--strong {
  background: color-mix(in srgb, var(--colors-text-text-primary) 13%, transparent);
}

.mock__pin {
  border-radius: 50% 50% 50% 0;
  transform: rotate(-45deg);
}

.mock__avatar {
  border: 3px solid var(--colors-background-bg-page);
}
</style>
