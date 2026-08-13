import type { Accordions } from '../components/type'
import { SINGLE_BASIC_INFO_FIELDS } from '../components/type'

/**
 * 批量 / 导入：窗口组 outside + 基础/高级指纹/偏好 三组。
 */
export function createDefaultWindowAccordions(): Accordions {
  return {
    value: [],
    panels: [
      { value: 'window', groupIndex: 0, placement: 'outside', variant: 'window' },
      ...[$t('基础设置'), $t('高级指纹设置'), $t('偏好设置')]
        .map((title, index) => ({
          title,
          value: index.toString(),
          groupIndex: index + 1,
          placement: 'accordion' as const,
        })),
    ],
  }
}

/**
 * 单个创建 / 编辑：基础信息在 #before，剩余窗口字段并入「基础设置」。
 */
export function createSingleWindowAccordions(): Accordions {
  return {
    value: [],
    panels: [
      {
        title: $t('基础设置'),
        value: 'basic',
        groupIndex: 0,
        extraGroupIndexes: [1],
        placement: 'accordion',
        variant: 'window',
        excludedFields: [...SINGLE_BASIC_INFO_FIELDS],
      },
      {
        title: $t('高级指纹设置'),
        value: 'high',
        groupIndex: 2,
        placement: 'accordion',
      },
      {
        title: $t('偏好设置'),
        value: 'other',
        groupIndex: 3,
        placement: 'accordion',
      },
    ],
  }
}
