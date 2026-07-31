import type { PageLocale } from './locale'

export interface PageMessages {
  brandTitle: string
  serviceChangeBadge: string
  publishedAt: string
  announcementTitle: string
  /** 称呼，空字符串时不渲染 */
  salutation: string
  paragraphs: string[]
  tableTitle: string
  tableColIpChange: string
  tableColExpireChange: string
  loading: string
  loadFailed: string
  networkError: string
  emptyList: string
  expireExtendBadge: string
  contactHint: string
  contactButton: string
  copyNewIp: string
  copyFailed: string
  emptyCell: string
}

export const PAGE_MESSAGES: Record<PageLocale, PageMessages> = {
  'zh-CN': {
    brandTitle: 'Roxy浏览器',
    serviceChangeBadge: '服务变更通知',
    publishedAt: '发布于2026-07-31 16:30',
    announcementTitle: '关于部分代理 IP 不可用及资源置换的公告',
    salutation: '',
    paragraphs: [
      '因上游运营商网络资源调整,您账户下的部分美国代理 IP 受到影响。对于此次调整可能给您带来的不便,我们深表歉意。',
      '为保障您的服务持续稳定使用,我们已将每个受影响的美国 IP 自动更换为同规格的美国 IP,新 IP 现已生效。您无需重新购买服务,也无需手动操作。代理 IP 变更对照请见下表。',
      '如您曾在其他平台配置原 IP 白名单或相关业务设置,请使用下表中的新 IP 及时更新,以免影响后续使用。',
      '我们充分理解 IP 更换可能给您的业务带来不便。为此,我们已将每个受影响 IP 的有效期自动延长 30 天作为补偿,无需手动领取,也不会额外收费。',
      '如您在使用过程中遇到任何问题,欢迎随时联系 Roxy 客服,我们将尽快协助您处理。',
      '再次对此次调整给您带来的不便深表歉意,感谢您一直以来的理解、信任与支持。',
    ],
    tableTitle: '变更后的代理 IP',
    tableColIpChange: 'IP 地址变化',
    tableColExpireChange: '到期时间变化',
    loading: '加载中…',
    loadFailed: '加载失败，请稍后重试。',
    networkError: '网络异常，请稍后重试。',
    emptyList: '暂无受影响的代理 IP 记录。',
    expireExtendBadge: '+30天',
    contactHint: '如有其他疑问，可联系客服',
    contactButton: '联系客服',
    copyNewIp: '复制新 IP',
    copyFailed: '复制失败，请重试',
    emptyCell: '-',
  },
  'en': {
    brandTitle: 'RoxyBrowser',
    serviceChangeBadge: 'Service Change Notice',
    publishedAt: 'Published on Jul 31, 2026 16:30 (UTC+8)',
    announcementTitle: 'Notice on Partial Proxy IP Unavailability and Resource Replacement',
    salutation: '',
    paragraphs: [
      'Due to network resource adjustments by upstream carriers, some US proxy IPs under your account have been affected. We sincerely apologize for any inconvenience this may cause.',
      'To keep your service running smoothly, we have automatically replaced each affected US IP with a US IP of the same specifications. The new IPs are now active. You do not need to repurchase or take manual action. Please refer to the comparison table below.',
      'If you have configured allowlists or related settings for the original IPs on other platforms, please update them with the new IPs in the table below to avoid disruption.',
      'We understand that IP replacement may affect your operations. As compensation, we have automatically extended the validity of each affected IP by 30 days at no extra charge.',
      'If you encounter any issues, please contact Roxy Support and we will assist you as soon as possible.',
      'We apologize again for any inconvenience and thank you for your understanding, trust, and continued support.',
    ],
    tableTitle: 'Replaced Proxy IPs',
    tableColIpChange: 'IP Address Change',
    tableColExpireChange: 'Expiration Change',
    loading: 'Loading…',
    loadFailed: 'Failed to load. Please try again later.',
    networkError: 'Network error. Please try again later.',
    emptyList: 'No affected proxy IP records.',
    expireExtendBadge: '+30 days',
    contactHint: 'If you have any questions, contact support',
    contactButton: 'Contact Us',
    copyNewIp: 'Copy new IP',
    copyFailed: 'Copy failed. Please try again.',
    emptyCell: '-',
  },
  'ru': {
    brandTitle: 'RoxyBrowser',
    serviceChangeBadge: 'Уведомление об изменении сервиса',
    publishedAt: 'Опубликовано 31.07.2026 16:30 (UTC+8)',
    announcementTitle: 'Уведомление о недоступности части прокси IP и замене ресурсов',
    salutation: '',
    paragraphs: [
      'В связи с изменением сетевых ресурсов у upstream-операторов часть US proxy IP в вашем аккаунте была затронута. Приносим извинения за возможные неудобства.',
      'Чтобы обеспечить стабильную работу сервиса, мы автоматически заменили каждый затронутый US IP на US IP с теми же характеристиками. Новые IP уже активны. Перепокупка и ручные действия не требуются. Сравнение изменений см. в таблице ниже.',
      'Если вы настраивали whitelist или другие параметры для старых IP на других платформах, обновите их новыми IP из таблицы ниже.',
      'Мы понимаем, что замена IP может повлиять на ваш бизнес. В качестве компенсации срок действия каждого затронутого IP автоматически продлён на 30 дней без дополнительной оплаты.',
      'При возникновении вопросов обращайтесь в поддержку Roxy — мы поможем как можно скорее.',
      'Ещё раз приносим извинения за неудобства и благодарим за понимание, доверие и поддержку.',
    ],
    tableTitle: 'Заменённые proxy IP',
    tableColIpChange: 'Изменение IP',
    tableColExpireChange: 'Изменение срока',
    loading: 'Загрузка…',
    loadFailed: 'Не удалось загрузить. Повторите попытку позже.',
    networkError: 'Ошибка сети. Повторите попытку позже.',
    emptyList: 'Нет затронутых proxy IP.',
    expireExtendBadge: '+30 дн.',
    contactHint: 'Если остались вопросы, свяжитесь с поддержкой',
    contactButton: 'Связаться с нами',
    copyNewIp: 'Копировать новый IP',
    copyFailed: 'Не удалось скопировать. Повторите попытку.',
    emptyCell: '-',
  },
}
