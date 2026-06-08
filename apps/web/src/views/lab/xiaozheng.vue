<script setup lang="ts">
import ScrollOverflowEffect from '/@/components/scroll-overflow-effect.vue'

type EffectMode = 'indicator' | 'shadow' | 'opening' | 'mask'

const activeMode = ref<EffectMode>('opening')
const light = ref(false)
const resizable = ref(true)
const shadowHeight = ref(12)
const shadowOpacity = ref(0.5)

const modes: Array<{ label: string, value: EffectMode }> = [
  { label: 'Indicator', value: 'indicator' },
  { label: 'Shadow', value: 'shadow' },
  { label: 'Opening', value: 'opening' },
  { label: 'Mask', value: 'mask' },
]

const paragraphs = [
  '这个组件把原来 codepen 里的滚动提示效果封装成了一个独立的 Vue 3 组件，内容通过默认插槽传入，所以后续不管是文章卡片、设置面板还是帮助说明，都可以直接复用。',
  '顶部和底部的状态不再依赖 gsap，而是根据当前滚动位置、容器高度和内容总高度实时计算两个进度值，再通过 CSS 变量驱动不同模式的视觉变化。',
  'Indicator 模式更像传统的滚动提示条，适合让用户明确知道还有内容没看完；Shadow 和 Opening 更克制一些，适合后台面板或侧边抽屉。',
  'Mask 模式则更偏视觉化，会把内容边缘直接做成渐隐遮罩，整体会比单独的箭头或阴影更轻，但也更依赖内容区本身的背景和排版。',
  '如果你后面想把它接到业务页面里，我建议保留目前这套 props：模式、亮暗、阴影高度、透明度、边缘阈值和是否允许手动 resize，已经足够覆盖大部分场景。',
  '实验室页面这里我把容器设成了可拖拽缩放，这样你可以顺手看一眼不同尺寸下的表现，尤其是较短容器和较长文案组合时，顶底提示是否还自然。',
  '后续如果你想继续增强，也可以把标题区、底部操作栏、滚动到顶/底的快捷按钮一起做进插槽体系里，不过我先保持组件职责单一，方便后面继续演进。',
]
</script>

<template>
  <div class="scroll-lab">
    <div class="scroll-lab__intro">
      <p class="scroll-lab__eyebrow">
        Scroll Overflow Effect
      </p>
      <h2 class="scroll-lab__title">
        CodePen 效果 Vue 3 封装预览
      </h2>
      <p class="scroll-lab__desc">
        现在可以直接切换模式和参数，确认最终想保留的表现。组件内部已经去掉 `gsap`，改成原生滚动计算。
      </p>
    </div>

    <div class="scroll-lab__panel">
      <div class="scroll-lab__controls">
        <div class="scroll-lab__control-group">
          <span class="scroll-lab__label">模式</span>
          <div class="scroll-lab__mode-list">
            <button
              v-for="item in modes"
              :key="item.value"
              type="button"
              class="scroll-lab__mode-button"
              :class="{ 'is-active': activeMode === item.value }"
              @click="activeMode = item.value"
            >
              {{ item.label }}
            </button>
          </div>
        </div>

        <label class="scroll-lab__switch">
          <input v-model="light" type="checkbox">
          <span>亮色模式</span>
        </label>

        <label class="scroll-lab__switch">
          <input v-model="resizable" type="checkbox">
          <span>允许拖拽缩放</span>
        </label>

        <label class="scroll-lab__range">
          <span>阴影高度</span>
          <input v-model.number="shadowHeight" type="range" min="4" max="24" step="1">
          <strong>{{ shadowHeight }}px</strong>
        </label>

        <label class="scroll-lab__range">
          <span>阴影透明度</span>
          <input v-model.number="shadowOpacity" type="range" min="0.1" max="0.9" step="0.05">
          <strong>{{ shadowOpacity.toFixed(2) }}</strong>
        </label>
      </div>

      <div class="scroll-lab__preview">
        <ScrollOverflowEffect
          :mode="activeMode"
          :light="light"
          :resizable="resizable"
          :shadow-height="shadowHeight"
          :shadow-opacity="shadowOpacity"
          width="min(42ch, 100%)"
          max-height="640px"
        >
          <p v-for="paragraph in paragraphs" :key="paragraph">
            {{ paragraph }}
          </p>
        </ScrollOverflowEffect>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.scroll-lab {
  min-height: 100%;
  padding: 24px;
  color: var(--colors-text-color-primary);
  background:
    radial-gradient(circle at top left, rgb(76 132 255 / 0.16), transparent 28%),
    radial-gradient(circle at right, rgb(16 185 129 / 0.14), transparent 24%),
    linear-gradient(180deg, var(--colors-background-bg-block), rgb(8 12 20 / 0.04));
}

.scroll-lab__intro {
  max-width: 760px;
}

.scroll-lab__eyebrow {
  margin: 0 0 8px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: rgb(56 189 248);
}

.scroll-lab__title {
  margin: 0;
  font-size: 30px;
  line-height: 1.15;
}

.scroll-lab__desc {
  margin: 12px 0 0;
  max-width: 760px;
  font-size: 14px;
  line-height: 1.7;
  color: var(--colors-text-color-secondary);
}

.scroll-lab__panel {
  display: grid;
  grid-template-columns: minmax(280px, 360px) minmax(320px, 1fr);
  gap: 20px;
  margin-top: 24px;
}

.scroll-lab__controls,
.scroll-lab__preview {
  border: 1px solid rgb(148 163 184 / 0.18);
  border-radius: 24px;
  background: rgb(255 255 255 / 0.72);
  backdrop-filter: blur(20px);
  box-shadow: 0 24px 80px -44px rgb(15 23 42 / 0.45);
}

.scroll-lab__controls {
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 20px;
}

.scroll-lab__control-group {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.scroll-lab__label {
  font-size: 13px;
  font-weight: 600;
  color: var(--colors-text-color-secondary);
}

.scroll-lab__mode-list {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.scroll-lab__mode-button {
  padding: 9px 14px;
  border: 1px solid rgb(148 163 184 / 0.25);
  border-radius: 999px;
  background: transparent;
  font-size: 13px;
  font-weight: 600;
  color: var(--colors-text-color-primary);
  cursor: pointer;
  transition: all 160ms ease;
}

.scroll-lab__mode-button:hover {
  border-color: rgb(59 130 246 / 0.45);
  transform: translateY(-1px);
}

.scroll-lab__mode-button.is-active {
  border-color: transparent;
  background: linear-gradient(135deg, rgb(37 99 235), rgb(14 165 233));
  color: #fff;
  box-shadow: 0 12px 30px -18px rgb(37 99 235 / 0.9);
}

.scroll-lab__switch,
.scroll-lab__range {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 14px;
}

.scroll-lab__switch input {
  width: 16px;
  height: 16px;
}

.scroll-lab__range {
  justify-content: space-between;
}

.scroll-lab__range span {
  min-width: 84px;
}

.scroll-lab__range input[type='range'] {
  flex: 1;
}

.scroll-lab__range strong {
  min-width: 52px;
  text-align: right;
  font-size: 13px;
}

.scroll-lab__preview {
  display: grid;
  place-items: center;
  padding: 24px;
}

@media (max-width: 900px) {
  .scroll-lab__panel {
    grid-template-columns: 1fr;
  }

  .scroll-lab__title {
    font-size: 24px;
  }
}
</style>
