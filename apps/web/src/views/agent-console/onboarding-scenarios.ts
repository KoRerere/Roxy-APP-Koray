import { scanComposerProtocolTokens } from './components/chat-composer/protocol'
import type { TemplateIconInfo } from './template-store'
import { isTemplateImageIconSource, pickTemplateThemeValue } from './template-store'

export type OnboardingScenarioId
  = | 'copy-editing'
    | 'ad-creative'
    | 'tiktok-captions'
    | 'reddit-post'

type SupportedLocale = 'en' | 'ru' | 'zh'

interface ScenarioInputPrefill {
  labels: string[]
  values: Partial<Record<SupportedLocale, string>>
}

export const ONBOARDING_TEMPLATE_SLUGS: Record<OnboardingScenarioId, string> = {
  'copy-editing': 'copy-editing',
  'ad-creative': 'ad-creative',
  'tiktok-captions': 'tiktok-captions',
  'reddit-post': 'reddit-posts',
}

export interface OnboardingScenarioIcon {
  source: string
  isImage: boolean
}

export function resolveOnboardingScenarioIcon(
  iconInfo: TemplateIconInfo | null | undefined,
  fallback: string,
  darkTheme: boolean,
): OnboardingScenarioIcon {
  const source = pickTemplateThemeValue(iconInfo?.icon, darkTheme) || fallback
  return {
    source,
    isImage: isTemplateImageIconSource(source),
  }
}

const ONBOARDING_SCENARIO_IDS = new Set<OnboardingScenarioId>(
  Object.keys(ONBOARDING_TEMPLATE_SLUGS) as OnboardingScenarioId[],
)

const SCENARIO_INPUT_PREFILLS: Record<OnboardingScenarioId, ScenarioInputPrefill[]> = {
  'copy-editing': [
    {
      labels: ['原文', 'copy', 'текст'],
      values: {
        en: 'This smart water bottle is made of 316 stainless steel, offers long-lasting insulation, supports app connectivity, and lets you check your water intake anytime. It is ideal for office workers.',
        ru: 'Эта умная бутылка для воды изготовлена из нержавеющей стали 316, долго сохраняет температуру, поддерживает подключение к приложению и позволяет в любой момент проверить количество выпитой воды. Подходит для офисных работников.',
        zh: '这款智能水杯采用316不锈钢材质，长效保温，支持APP连接，随时查看饮水量，适合上班族使用。',
      },
    },
    {
      labels: ['受众', 'audience', 'аудитории'],
      values: {
        en: 'Urban professionals aged 25-35 who care about their health but lead busy lives, prefer minimalist design, and often forget to drink water',
        ru: 'Городские офисные сотрудники 25-35 лет, которые заботятся о здоровье, но ведут активный образ жизни, любят минималистичный дизайн и часто забывают пить воду',
        zh: '25-35岁都市白领，注重健康但忙碌，喜欢简约设计，经常忘记喝水',
      },
    },
    {
      labels: ['语气', 'tone', 'тон'],
      values: {
        en: 'Friendly, conversational, and slightly encouraging; avoid stiff technical jargon',
        ru: 'Дружелюбный, разговорный, немного вдохновляющий тон; избегать сухих технических терминов',
        zh: '亲切、生活化、带点鼓励感，避免生硬技术术语',
      },
    },
  ],
  'ad-creative': [
    {
      labels: ['产品/服务', 'product or service', 'продукта или услуги'],
      values: {
        en: 'anti-detect browser',
        ru: 'антидетект-браузера',
        zh: '指纹浏览器',
      },
    },
    {
      labels: ['受众', 'audience', 'целевая аудитория'],
      values: {
        en: 'cross-border e-commerce sellers',
        ru: 'продавцов, работающих в сфере трансграничной электронной торговли',
        zh: '跨境商家',
      },
    },
    {
      labels: ['平台和格式', 'platform and format', 'платформа и формат'],
      values: { en: 'TikTok', ru: 'TikTok', zh: 'TikTok' },
    },
  ],
  'tiktok-captions': [
    {
      labels: ['产品或主题', 'product or topic', 'продукте или теме'],
      values: {
        en: 'Optimum Nutrition protein powder',
        ru: 'протеиновый порошок Optimum Nutrition',
        zh: 'Optimum Nutrition 蛋白粉',
      },
    },
    {
      labels: ['目标人群', 'audience', 'целевой аудитории'],
      values: {
        en: 'fitness enthusiasts',
        ru: 'фитнес-энтузиасты',
        zh: '健身人士',
      },
    },
  ],
  'reddit-post': [
    {
      labels: [
        '主题或产品',
        'Product or topic',
        'Product name or topic',
        'название продукта или тема',
      ],
      values: { en: 'DeepSeek', ru: 'DeepSeek', zh: 'DeepSeek' },
    },
    {
      labels: [
        'subreddit',
        'Target subreddit',
        'Target subreddit, e.g. r/Entrepreneur or r/Productivity',
        'целевой subreddit',
        'целевой subreddit, например r/Entrepreneur или r/Productivity',
      ],
      values: { en: 'r/selfhosted', ru: 'r/selfhosted', zh: 'r/selfhosted' },
    },
    {
      labels: [
        '发帖目标',
        'Posting goal',
        'Posting goal, e.g. get feedback/share experience/spark discussion/soft promotion',
        'цель публикации',
        'цель публикации, например получить обратную связь',
      ],
      values: {
        en: 'discuss the cost-effectiveness of the DeepSeek API and attract self-hosting enthusiasts',
        ru: 'обсудить экономическую эффективность API DeepSeek и привлечь энтузиастов самостоятельного хостинга',
        zh: '讨论 DeepSeek API 的成本效益，吸引自部署爱好者关注',
      },
    },
    {
      labels: [
        'Target users, e.g. independent store sellers',
        'целевая аудитория, например продавцы независимых магазинов',
      ],
      values: { en: 'software developers', ru: 'разработчики программного обеспечения' },
    },
    {
      labels: [
        'Expressions to avoid, e.g. too salesy',
        'формулировки которых нужно избегать, например слишком рекламный тон',
      ],
      values: { en: 'too salesy', ru: 'слишком рекламный тон' },
    },
  ],
}

function normalizeLocale(locale?: string): SupportedLocale {
  const normalized = locale?.trim().toLowerCase()
  if (normalized?.startsWith('en')) {
    return 'en'
  }
  if (normalized?.startsWith('ru')) {
    return 'ru'
  }
  return 'zh'
}

function normalizeInputLabel(label: string): string {
  return label.trim().replace(/\s+/g, ' ').toLocaleLowerCase()
}

export function isOnboardingScenarioId(value: string): value is OnboardingScenarioId {
  return ONBOARDING_SCENARIO_IDS.has(value as OnboardingScenarioId)
}

export function buildOnboardingTemplatePrompt(templateChatPrompt: string, officialPrompt: string): string {
  const skillToken = scanComposerProtocolTokens(templateChatPrompt)
    .find(token => token.kind === 'skill' && token.skillPath)
  const normalizedPrompt = officialPrompt.trim()

  return skillToken ? `${skillToken.raw} ${normalizedPrompt}`.trim() : ''
}

export function fillOnboardingScenarioInputs(
  prompt: string,
  scenario: OnboardingScenarioId,
  locale?: string,
): string {
  const localizedValues = new Map<string, string>()
  const supportedLocale = normalizeLocale(locale)

  SCENARIO_INPUT_PREFILLS[scenario].forEach((prefill) => {
    const value = prefill.values[supportedLocale]
    if (!value) {
      return
    }

    prefill.labels.forEach((label) => {
      localizedValues.set(normalizeInputLabel(label), value)
    })
  })

  let cursor = 0
  let result = ''

  scanComposerProtocolTokens(prompt).forEach((token) => {
    if (token.kind !== 'input' && token.kind !== 'textarea' && token.kind !== 'url') {
      return
    }

    const value = localizedValues.get(normalizeInputLabel(token.title))
    if (!value) {
      return
    }

    result += prompt.slice(cursor, token.index)
    result += `[${token.kind}:${token.title}](${value})`
    cursor = token.index + token.raw.length
  })

  return cursor ? `${result}${prompt.slice(cursor)}` : prompt
}
