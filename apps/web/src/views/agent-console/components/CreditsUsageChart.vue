<script setup lang="ts">
import { BarChart } from 'echarts/charts'
import { GridComponent, TooltipComponent } from 'echarts/components'
import * as echarts from 'echarts/core'
import type { ECharts, EChartsCoreOption } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'

export interface CreditsUsageDatum {
  date: string
  axisLabel: string
  tooltipDate: string
  points: number
}

const props = defineProps<{
  data: CreditsUsageDatum[]
}>()

echarts.use([BarChart, GridComponent, TooltipComponent, CanvasRenderer])

const chartRef = ref<HTMLElement | null>(null)
let chart: ECharts | undefined
let resizeObserver: ResizeObserver | undefined
let themeObserver: MutationObserver | undefined
const pointsFormatter = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 2,
})

function readCssVariable(name: string, fallback: string) {
  if (!chartRef.value) {
    return fallback
  }

  return getComputedStyle(chartRef.value).getPropertyValue(name).trim() || fallback
}

function getVisibleLabelIndexes(length: number) {
  const lastIndex = length - 1
  if (lastIndex <= 0) {
    return new Set([0])
  }

  return new Set(Array.from({ length: 5 }, (_, index) => Math.round((lastIndex * index) / 4)))
}

function buildOption(): EChartsCoreOption {
  const labelIndexes = getVisibleLabelIndexes(props.data.length)
  const textPrimary = readCssVariable('--color-text-primary', '#141414')
  const textQuaternary = readCssVariable('--color-text-quaternary', '#737373')
  const borderPrimary = readCssVariable('--color-border-primary', '#d6d6d6')
  const tooltipBackground = readCssVariable('--color-bg-primary', '#fcfcfc')

  return {
    animationDuration: 300,
    grid: {
      left: 0,
      right: 0,
      top: 8,
      bottom: 21,
      containLabel: true,
    },
    tooltip: {
      trigger: 'axis',
      confine: true,
      padding: 16,
      backgroundColor: tooltipBackground,
      borderWidth: 0,
      extraCssText: 'min-width: 174px; border-radius: 16px; box-shadow: 0 3px 8px rgb(0 0 0 / 7%), 0 2px 5px rgb(0 0 0 / 7%), 0 1px 1px rgb(0 0 0 / 7%);',
      textStyle: {
        color: textPrimary,
        fontFamily: 'Inter, sans-serif',
        fontSize: 14,
        fontWeight: 500,
        lineHeight: 20,
      },
      axisPointer: {
        type: 'line',
        lineStyle: {
          color: '#6938ee',
          width: 1,
          type: 'dashed',
        },
      },
      formatter: (params: unknown) => {
        const item = (Array.isArray(params) ? params[0] : params) as { dataIndex?: number, value?: unknown } | undefined
        const dataIndex = item?.dataIndex ?? 0
        const datum = props.data[dataIndex]
        const points = Number(item?.value ?? datum?.points ?? 0)

        return [
          `<div style="margin-bottom:8px">${datum?.tooltipDate ?? ''}</div>`,
          '<div style="display:flex;align-items:center;justify-content:space-between;gap:24px">',
          `<span>${$t('使用积分')}</span>`,
          `<span>${pointsFormatter.format(Number.isFinite(points) ? points : 0)}</span>`,
          '</div>',
        ].join('')
      },
    },
    xAxis: {
      type: 'category',
      boundaryGap: true,
      data: props.data.map(item => item.date),
      axisLine: {
        show: true,
        lineStyle: {
          color: borderPrimary,
          width: 1,
        },
      },
      axisTick: { show: false },
      axisLabel: {
        show: true,
        interval: 0,
        margin: 5,
        color: textQuaternary,
        fontFamily: 'Inter, sans-serif',
        fontSize: 12,
        fontWeight: 500,
        lineHeight: 16,
        formatter: (_value: string, index: number) => labelIndexes.has(index) ? props.data[index]?.axisLabel ?? '' : '',
      },
      axisPointer: {
        show: true,
        snap: true,
      },
    },
    yAxis: {
      type: 'value',
      min: 0,
      splitNumber: 2,
      minInterval: 1,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        show: true,
        margin: 10,
        color: textQuaternary,
        fontFamily: 'Inter, sans-serif',
        fontSize: 12,
        fontWeight: 500,
        lineHeight: 16,
        formatter: (value: number) => pointsFormatter.format(value),
      },
      splitLine: {
        show: true,
        lineStyle: {
          color: borderPrimary,
          width: 1,
          type: 'solid',
        },
      },
    },
    series: [
      {
        type: 'bar',
        data: props.data.map(item => item.points),
        barMaxWidth: 20,
        itemStyle: {
          color: '#6938ee',
          borderRadius: [4, 4, 0, 0],
        },
        emphasis: {
          itemStyle: {
            color: '#6938ee',
          },
        },
      },
    ],
  }
}

function renderChart() {
  if (!chartRef.value) {
    return
  }

  chart ??= echarts.init(chartRef.value, null, { renderer: 'canvas' })
  chart.setOption(buildOption(), true)
}

watch(
  () => props.data,
  () => nextTick(renderChart),
  { deep: true },
)

onMounted(() => {
  renderChart()

  if (typeof ResizeObserver !== 'undefined' && chartRef.value) {
    resizeObserver = new ResizeObserver(() => chart?.resize())
    resizeObserver.observe(chartRef.value)
  }

  themeObserver = new MutationObserver(() => nextTick(renderChart))
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class', 'data-theme'],
  })
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  themeObserver?.disconnect()
  chart?.dispose()
  chart = undefined
})
</script>

<template>
  <section class="usage-chart" :aria-label="$t('使用记录')">
    <h2>{{ $t('使用记录') }}</h2>
    <div ref="chartRef" class="usage-chart__canvas" role="img" :aria-label="$t('使用记录')" />
  </section>
</template>

<style scoped lang="scss">
.usage-chart {
  position: relative;
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  min-height: 0;
  border-radius: 12px;
  background: var(--color-bg-tertiary);
  overflow: hidden;

  h2 {
    position: absolute;
    z-index: 1;
    top: 20px;
    left: 20px;
    margin: 0;
    color: var(--color-text-primary);
    font-size: 14px;
    font-weight: 500;
    line-height: 20px;
  }
}

.usage-chart__canvas {
  position: absolute;
  inset: 60px 20px 20px;
}
</style>
