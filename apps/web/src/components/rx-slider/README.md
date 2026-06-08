# RxSlider

非线性范围滑块组件。支持分段步长、最小值约束、两端留白、跟随卡片等特性，通过具名插槽自定义刻度标签和浮动内容。

在线演示：`/slider-demo`

---

## 快速上手

```vue
<RxSlider v-model="value" :marks="marks" :padding="0.015">
  <template #mark="{ value }">{{ value }}</template>
  <template #popup="{ value }">{{ value }} 个窗口</template>
</RxSlider>
```

---

## Props

### `marks` · `SliderMark[]` · 必填

刻度定义数组，**至少两个元素**，决定滑轨的分段结构。

```ts
interface SliderMark {
  value: number   // 刻度的数值
  step?: number   // 从该刻度到下一个刻度之间的步长（见下方说明）
}
```

**`step` 规则**

- `step` 属于"左刻度"，表示从当前刻度到下一个刻度之间每隔多少跳一格。
- 要求能整除区间长度：`(nextMark.value - mark.value) % step === 0`，否则会触发 `Math.round()` 修正，导致末尾值偏移。
- 省略 `step` 时，该段视为"整段一步"，即直接从当前刻度跳到下一个刻度值，中间无中间档。
- **最后一个 mark 的 `step` 无意义**，会被忽略。

```ts
// 示例：0 → 10 每步 5；10 → 100 每步 10；100 → 1000 整段一步
const marks = [
  { value: 0 },
  { value: 10, step: 5 },   // 产生 5, 10
  { value: 100, step: 10 }, // 产生 20, 30, ..., 100
  { value: 1000 },          // 产生 1000（整段一步）
]
```

---

### `v-model` · `number` · 默认 `0`

当前选中值，双向绑定。

- 若初始值不在可选列表中（如 `0` 表示免费档），滑块停在最左侧刻度处，不报错。
- 外部直接修改 `v-model` 时，滑块会动画到对应位置。

---

### `min` · `number` · 默认 `0`

最小可选值。

- 小于 `min` 的刻度点点击无效。
- 拖动时不会越过 `min` 对应的轨道位置。
- `min` 的值必须存在于可选列表中，否则约束以第一个可选值为准。

```vue
<!-- 存储滑块：最小 100 GB，不允许拖到免费档 -->
<RxSlider v-model="storage" :marks="storageMarks" :min="100" />
```

---

### `padding` · `number (0–1)` · 默认 `0`

两端留白比例。控制第一个和最后一个刻度距离滑轨两端的距离，防止刻度标签被截断。

| 值 | 效果 |
|---|---|
| `0` | 无留白，刻度贴边 |
| `0.015` | 定价页效果，轻微内缩 |
| `0.05` | 明显留白，适合标签较宽的场景 |

---

### `thumbSize` · `number` · 默认 `26`

滑块（圆形拖拽点）的直径，单位 px。同时影响渐变轨道的右裁剪量，确保渐变色恰好在滑块右边缘处结束。

---

### `markSize` · `number` · 默认 `10`

刻度点（轨道上的小圆点）的直径，单位 px。

---

### `cardWidth` · `number` · 默认 `0`

默认插槽（跟随卡片）的像素宽度。组件用它来防止卡片超出右边界：

- 卡片以 `-translate-x-50%` 居中对齐滑块，因此其中心最多停在 `(100 - cardWidth/2/sliderWidth×100)%` 处。
- 不传或传 `0` 时不做限制，卡片可能在滑块到达最右侧时溢出容器。

```vue
<!-- 卡片宽 222px，告知组件防止右溢 -->
<RxSlider v-model="val" :marks="marks" :card-width="222">
  <template #default="{ value }">
    <div style="width: 222px">...</div>
  </template>
</RxSlider>
```

---

## Slots

### `#mark` · `{ value: number, isActive: boolean }`

刻度标签，渲染在刻度点正下方。默认显示原始数值。

```vue
<template #mark="{ value, isActive }">
  <span :class="{ highlight: isActive }">
    {{ value >= 1000 ? `${value / 1000}k` : value }}
  </span>
</template>
```

---

### `#popup` · `{ value: number }`

滑块正上方的气泡提示。仅当 `v-model > 0` 时显示（免费档隐藏）。默认显示原始数值。

```vue
<template #popup="{ value }">
  {{ value }} 个窗口
</template>
```

---

### `#default` · `{ value: number, centerPct: number }`

跟随滑块水平移动的浮动卡片。绝对定位，中心与滑块中心对齐，向上偏移（`top: 13`）。

- `value`：当前选中值，用于渲染卡片内容。
- `centerPct`：滑块中心当前所在的百分比位置（`0–100`），可用于自定义定位逻辑。
- 配合 `cardWidth` prop 可防止卡片右侧溢出。

```vue
<RxSlider v-model="val" :marks="marks" :card-width="200">
  <template #default="{ value }">
    <div class="price-card" style="width: 200px">
      <div class="price">${{ calcPrice(value) }}</div>
      <div class="label">{{ value }} 个窗口</div>
    </div>
  </template>
</RxSlider>
```

> **注意**：默认插槽容器监听了 `mousedown` 事件，鼠标按住卡片也可拖动滑块，体验与直接拖动滑块一致。

---

## 完整示例

### 定价页窗口数量

```vue
<script setup>
const windows = ref(10)

const marks = [
  { value: 0 },
  { value: 5,     step: 5 },
  { value: 10,    step: 40 },
  { value: 50,    step: 50 },
  { value: 100,   step: 100 },
  { value: 500,   step: 100 },
  { value: 1000,  step: 100 },
  { value: 5000,  step: 100 },
  { value: 10000, step: 100 },
  { value: 50000, step: 100 },
  { value: 100000 },
]

function label(v) {
  return v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v
}
</script>

<template>
  <RxSlider v-model="windows" :marks="marks" :padding="0.015" :min="5">
    <template #mark="{ value }">{{ label(value) }}</template>
    <template #popup="{ value }">{{ label(value) }} 个窗口</template>
  </RxSlider>
</template>
```

### 存储空间（带单位换算）

```vue
<script setup>
const storage = ref(100)

const marks = [
  { value: 0 },
  { value: 100,   step: 100 },
  { value: 500,   step: 500 },
  { value: 2000,  step: 2000 },
  { value: 10000 },
]

function label(v) {
  if (v === 0) return '0'
  return v >= 1000 ? `${(v / 1000).toFixed(0)}TB` : `${v}GB`
}
</script>

<template>
  <RxSlider v-model="storage" :marks="marks" :padding="0.05" :min="100">
    <template #mark="{ value }">{{ label(value) }}</template>
    <template #popup="{ value }">{{ label(value) }}</template>
  </RxSlider>
</template>
```

### 带跟随卡片

```vue
<template>
  <RxSlider v-model="val" :marks="marks" :padding="0.015" :card-width="222">
    <template #mark="{ value }">{{ label(value) }}</template>
    <template #default="{ value }">
      <div class="card" style="width: 222px; text-align: center">
        <div class="price">{{ unitPrice(value) }} / 窗口</div>
        <div class="count">{{ value }} 个窗口</div>
      </div>
    </template>
  </RxSlider>
</template>
```

---

## 内部实现要点

### 可选值展开（buildSelectables）

组件在初始化时将 `marks + step` 展开为两个平行数组：

- `selectableValues`：所有可选的数值，如 `[5, 10, 50, 100, ...]`
- `selectablePositions`：对应的轨道百分比位置

拖动和点击时，通过比较鼠标位置落在哪两个相邻 `selectablePositions` 之间（取中点）来决定选中哪个值。

### 滑块位置的两个坐标

| 变量 | 含义 | 用途 |
|---|---|---|
| `thumbCenterPct` | 滑块**中心**的 % 位置 | 定位浮动卡片 |
| `thumbLeftPct` | 滑块**左边缘**的 % 位置 | 定位滑块 DOM |

两者通过 `setThumbPosition(centerPct)` 原子更新，避免闪烁。

### resize 防抖

使用 `@vueuse/core` 的 `useResizeObserver` 监听滑块元素自身的尺寸变化（而非 `window.resize`），配合 `useDebounceFn(init, 100)` 防抖，避免在父容器动画过程中频繁重算。

---

## 注意事项

1. **`step` 必须能整除区间长度**。例如 `{ value: 100, step: 300 }` 到下一个刻度 `{ value: 1000 }` 时，`(1000 - 100) / 300 = 3`，整除，✅；若改为 `step: 400`，`(1000 - 100) / 400 = 2.25`，不整除 ❌，组件会 `Math.round()` 修正但末尾值会偏移。

2. **`marks` 至少需要两个元素**，否则组件不渲染任何可选值，滑块停在最左侧。

3. **免费档（value = 0）约定**：组件约定当 `v-model` 为 `0` 且 `0` 不在可选列表中时，滑块停在最左侧刻度处，`#popup` 插槽不显示。这是定价页"免费档"的惯例，如不需要可将 `min` 设为第一个可选值。

4. **`$attrs` 透传**：`<div ref="sliderRoot" v-bind="$attrs">` 会将外部传入的 class / style 透传到根元素，可直接在调用处控制宽度、margin 等布局属性。
