import assert from 'node:assert/strict'
// eslint-disable-next-line test/no-import-node-test
import { describe, it } from 'node:test'
import {
  buildOnboardingTemplatePrompt,
  fillOnboardingScenarioInputs,
  ONBOARDING_TEMPLATE_SLUGS,
  resolveOnboardingScenarioIcon,
} from './onboarding-scenarios'

describe('Agent onboarding scenarios', () => {
  it('maps each scenario to its official Skill template', () => {
    assert.deepEqual(ONBOARDING_TEMPLATE_SLUGS, {
      'copy-editing': 'copy-editing',
      'ad-creative': 'ad-creative',
      'tiktok-captions': 'tiktok-captions',
      'reddit-post': 'reddit-posts',
    })
  })

  it('selects the light and dark official icon variants', () => {
    const iconInfo = {
      icon: {
        light: 'roxy-agent/rx-ic-light',
        dark: 'roxy-agent/rx-ic-dark',
      },
    }

    assert.deepEqual(resolveOnboardingScenarioIcon(iconInfo, 'fallback', false), {
      source: 'roxy-agent/rx-ic-light',
      isImage: false,
    })
    assert.deepEqual(resolveOnboardingScenarioIcon(iconInfo, 'fallback', true), {
      source: 'roxy-agent/rx-ic-dark',
      isImage: false,
    })
  })

  it('falls back to the available theme variant and then the default icon', () => {
    assert.deepEqual(resolveOnboardingScenarioIcon({
      icon: { light: 'https://example.com/icon.svg' },
    }, 'fallback', true), {
      source: 'https://example.com/icon.svg',
      isImage: true,
    })
    assert.deepEqual(resolveOnboardingScenarioIcon(null, 'fallback', false), {
      source: 'fallback',
      isImage: false,
    })
  })

  it('fills the Chinese copy editing prompt returned by the API', () => {
    assert.equal(
      fillOnboardingScenarioInputs(
        '润色以下营销文案：[input:原文]()；目标受众 [input:受众]()，语气 [input:语气]()，请保留核心信息并说明关键修改。',
        'copy-editing',
        'zh-CN',
      ),
      '润色以下营销文案：[input:原文](这款智能水杯采用316不锈钢材质，长效保温，支持APP连接，随时查看饮水量，适合上班族使用。)；目标受众 [input:受众](25-35岁都市白领，注重健康但忙碌，喜欢简约设计，经常忘记喝水)，语气 [input:语气](亲切、生活化、带点鼓励感，避免生硬技术术语)，请保留核心信息并说明关键修改。',
    )
  })

  it('fills the Chinese ad creative prompt returned by the API', () => {
    assert.equal(
      fillOnboardingScenarioInputs(
        '为 [input:产品/服务]() 面向 [input:受众]() 生成 [input:平台和格式]() 广告，提供 3 个创意角度及各自的标题、正文和 CTA。',
        'ad-creative',
        'zh-CN',
      ),
      '为 [input:产品/服务](指纹浏览器) 面向 [input:受众](跨境商家) 生成 [input:平台和格式](TikTok) 广告，提供 3 个创意角度及各自的标题、正文和 CTA。',
    )
  })

  it('fills the Chinese TikTok captions prompt returned by the API', () => {
    assert.equal(
      fillOnboardingScenarioInputs(
        '为 [input:产品或主题]() 写一条面向 [input:目标人群]() 的 TikTok 内容，输出钩子、分镜脚本、发布文案、CTA 和标签。',
        'tiktok-captions',
        'zh-CN',
      ),
      '为 [input:产品或主题](Optimum Nutrition 蛋白粉) 写一条面向 [input:目标人群](健身人士) 的 TikTok 内容，输出钩子、分镜脚本、发布文案、CTA 和标签。',
    )
  })

  it('fills the Chinese Reddit prompt returned by the API', () => {
    assert.equal(
      fillOnboardingScenarioInputs(
        '为 [input:主题或产品]() 写一篇适合 [input:subreddit]() 的 Reddit 帖子，目标是 [input:发帖目标]()，输出 3 个标题、正文和首条回复。',
        'reddit-post',
        'zh-CN',
      ),
      '为 [input:主题或产品](DeepSeek) 写一篇适合 [input:subreddit](r/selfhosted) 的 Reddit 帖子，目标是 [input:发帖目标](讨论 DeepSeek API 的成本效益，吸引自部署爱好者关注)，输出 3 个标题、正文和首条回复。',
    )
  })

  const localizedPrefillCases: Array<{
    name: string
    scenario: Parameters<typeof fillOnboardingScenarioInputs>[1]
    locale: string
    fields: Array<[label: string, value: string]>
  }> = [
    {
      name: 'English copy editing inputs',
      scenario: 'copy-editing',
      locale: 'en-US',
      fields: [
        ['copy', 'This smart water bottle is made of 316 stainless steel, offers long-lasting insulation, supports app connectivity, and lets you check your water intake anytime. It is ideal for office workers.'],
        ['audience', 'Urban professionals aged 25-35 who care about their health but lead busy lives, prefer minimalist design, and often forget to drink water'],
        ['tone', 'Friendly, conversational, and slightly encouraging; avoid stiff technical jargon'],
      ],
    },
    {
      name: 'Russian copy editing inputs',
      scenario: 'copy-editing',
      locale: 'ru-RU',
      fields: [
        ['текст', 'Эта умная бутылка для воды изготовлена из нержавеющей стали 316, долго сохраняет температуру, поддерживает подключение к приложению и позволяет в любой момент проверить количество выпитой воды. Подходит для офисных работников.'],
        ['аудитории', 'Городские офисные сотрудники 25-35 лет, которые заботятся о здоровье, но ведут активный образ жизни, любят минималистичный дизайн и часто забывают пить воду'],
        ['тон', 'Дружелюбный, разговорный, немного вдохновляющий тон; избегать сухих технических терминов'],
      ],
    },
    {
      name: 'English ad creative inputs',
      scenario: 'ad-creative',
      locale: 'en-US',
      fields: [
        ['platform and format', 'TikTok'],
        ['product or service', 'anti-detect browser'],
        ['audience', 'cross-border e-commerce sellers'],
      ],
    },
    {
      name: 'Russian ad creative inputs',
      scenario: 'ad-creative',
      locale: 'ru-RU',
      fields: [
        ['платформа и формат', 'TikTok'],
        ['продукта или услуги', 'антидетект-браузера'],
        ['целевая аудитория', 'продавцов, работающих в сфере трансграничной электронной торговли'],
      ],
    },
    {
      name: 'English TikTok captions inputs',
      scenario: 'tiktok-captions',
      locale: 'en-US',
      fields: [
        ['product or topic', 'Optimum Nutrition protein powder'],
        ['audience', 'fitness enthusiasts'],
      ],
    },
    {
      name: 'Russian TikTok captions inputs',
      scenario: 'tiktok-captions',
      locale: 'ru-RU',
      fields: [
        ['продукте или теме', 'протеиновый порошок Optimum Nutrition'],
        ['целевой аудитории', 'фитнес-энтузиасты'],
      ],
    },
    {
      name: 'English Reddit inputs',
      scenario: 'reddit-post',
      locale: 'en-US',
      fields: [
        ['Product name or topic', 'DeepSeek'],
        ['Target subreddit, e.g. r/Entrepreneur or r/Productivity', 'r/selfhosted'],
        ['Posting goal, e.g. get feedback/share experience/spark discussion/soft promotion', 'discuss the cost-effectiveness of the DeepSeek API and attract self-hosting enthusiasts'],
        ['Target users, e.g. independent store sellers', 'software developers'],
        ['Expressions to avoid, e.g. too salesy', 'too salesy'],
      ],
    },
    {
      name: 'Russian Reddit inputs',
      scenario: 'reddit-post',
      locale: 'ru-RU',
      fields: [
        ['название продукта или тема', 'DeepSeek'],
        ['целевой subreddit, например r/Entrepreneur или r/Productivity', 'r/selfhosted'],
        ['цель публикации, например получить обратную связь', 'обсудить экономическую эффективность API DeepSeek и привлечь энтузиастов самостоятельного хостинга'],
        ['целевая аудитория, например продавцы независимых магазинов', 'разработчики программного обеспечения'],
        ['формулировки которых нужно избегать, например слишком рекламный тон', 'слишком рекламный тон'],
      ],
    },
  ]

  localizedPrefillCases.forEach(({ name, scenario, locale, fields }) => {
    it(`fills all ${name}`, () => {
      const prompt = fields.map(([label]) => `[input:${label}]()`).join('\n')
      const expected = fields.map(([label, value]) => `[input:${label}](${value})`).join('\n')

      assert.equal(fillOnboardingScenarioInputs(prompt, scenario, locale), expected)
    })
  })
  it('uses the dynamic Skill reference with the latest official prompt body', () => {
    const installedTemplatePrompt = '[$Copy Editing & Content Refresh](C:/Users/test/.roxy-agent/library/skills/installed/copy-editing/SKILL.md) Stale installed usage example.'
    const officialPrompt = 'Polish this marketing copy: [input:copy](). Keep the core message, adapt it for [input:audience]() in a [input:tone]() tone, and explain the key edits.'
    const prompt = buildOnboardingTemplatePrompt(installedTemplatePrompt, officialPrompt)

    assert.equal(
      fillOnboardingScenarioInputs(prompt, 'copy-editing', 'en-US'),
      '[$Copy Editing & Content Refresh](C:/Users/test/.roxy-agent/library/skills/installed/copy-editing/SKILL.md) Polish this marketing copy: [input:copy](This smart water bottle is made of 316 stainless steel, offers long-lasting insulation, supports app connectivity, and lets you check your water intake anytime. It is ideal for office workers.). Keep the core message, adapt it for [input:audience](Urban professionals aged 25-35 who care about their health but lead busy lives, prefer minimalist design, and often forget to drink water) in a [input:tone](Friendly, conversational, and slightly encouraging; avoid stiff technical jargon) tone, and explain the key edits.',
    )
  })

  it('does not build an onboarding prompt without a dynamic Skill reference', () => {
    assert.equal(
      buildOnboardingTemplatePrompt('Stale installed usage example.', 'Latest official prompt body.'),
      '',
    )
  })
})
