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
      {
        title: $t('基础设置'),
        tooltip: $t('系统已提供默认配置，无需修改即可创建；如需调整系统、内核、语言、时区、窗口大小等，可展开修改。'),
        value: '0',
        groupIndex: 1,
        placement: 'accordion' as const,
      },
      {
        title: $t('高级指纹设置'),
        tooltip: $t('系统已自动配置，一般无需修改；如需调整分辨率、WebRTC、WebGL、Canvas、设备等指纹参数，可展开修改。'),
        value: '1',
        groupIndex: 2,
        placement: 'accordion' as const,
      },
      {
        title: $t('偏好设置'),
        tooltip: $t('系统已提供默认配置；如需调整书签与数据同步、启动行为、网络规则等，可展开修改,'),
        value: '2',
        groupIndex: 3,
        placement: 'accordion' as const,
      },
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
        tooltip: $t('系统已提供默认配置，无需修改即可创建；如需调整系统、内核、语言、时区、窗口大小等，可展开修改。'),
        value: 'basic',
        groupIndex: 0,
        extraGroupIndexes: [1],
        placement: 'accordion',
        variant: 'window',
        excludedFields: [...SINGLE_BASIC_INFO_FIELDS],
      },
      {
        title: $t('高级指纹设置'),
        tooltip: $t('系统已自动配置，一般无需修改；如需调整分辨率、WebRTC、WebGL、Canvas、设备等指纹参数，可展开修改。'),
        value: 'high',
        groupIndex: 2,
        placement: 'accordion',
      },
      {
        title: $t('偏好设置'),
        tooltip: $t('系统已提供默认配置；如需调整书签与数据同步、启动行为、网络规则等，可展开修改,'),
        value: 'other',
        groupIndex: 3,
        placement: 'accordion',
      },
    ],
  }
}
