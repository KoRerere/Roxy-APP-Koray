import assert from 'node:assert/strict'
// eslint-disable-next-line test/no-import-node-test
import test from 'node:test'
import {
  isTemplateImageIconSource,
  mapTemplateStoreItem,
  pickLocalized,
  pickOfficialTemplatePrompt,
  pickTemplateThemeValue,
  serializeTemplateQuery,
} from './template-store'
import type { OfficialTemplate } from './template-store'

function officialTemplate(templateType: string, metadata: Record<string, unknown>): OfficialTemplate {
  return {
    id: 1,
    slug: 'official-demo',
    templateType,
    name: { en: 'Demo' },
    description: null,
    iconInfo: null,
    sortOrder: 0,
    isHot: false,
    metadata,
    labels: [],
    labelIds: [],
    createdAt: null,
    updatedAt: null,
  }
}

test('official Skill prompt uses the localized usageExample', () => {
  const template = officialTemplate('skill', {
    usageExample: {
      en: 'Use the demo skill',
      zh: '使用演示 Skill',
      ru: 'Используйте demo skill',
    },
  })

  assert.equal(pickOfficialTemplatePrompt(template, 'zh-CN'), '使用演示 Skill')
  assert.equal(pickOfficialTemplatePrompt(template, 'en-US'), 'Use the demo skill')
})

test('official prompt template continues to use metadata.prompt', () => {
  const template = officialTemplate('prompt', {
    prompt: { en: 'Prompt content', zh: '提示词内容' },
    usageExample: { en: 'Ignored example' },
  })

  assert.equal(pickOfficialTemplatePrompt(template, 'zh-CN'), '提示词内容')
})

test('localized text supports top-level Markdown arrays', () => {
  assert.equal(
    pickLocalized(['# 功能', '执行 **批量操作**。'], 'zh-CN'),
    '# 功能\n\n执行 **批量操作**。',
  )
})

test('localized text supports Markdown arrays inside locale objects', () => {
  assert.equal(
    pickLocalized({
      zh: ['# 功能', '中文描述'],
      us: ['# Purpose', 'English description'],
    }, 'zh-CN'),
    '# 功能\n\n中文描述',
  )
  assert.equal(
    pickLocalized({
      zh: ['# 功能', '中文描述'],
      us: ['# Purpose', 'English description'],
    }, 'en-US'),
    '# Purpose\n\nEnglish description',
  )
  assert.equal(
    pickLocalized({ zh: [' ', ''], us: ['English fallback'] }, 'zh-CN'),
    'English fallback',
  )
})

test('template icon helpers share theme fallback and image detection', () => {
  const pair = { light: 'light.svg', dark: 'dark.svg' }

  assert.equal(pickTemplateThemeValue(pair, false), 'light.svg')
  assert.equal(pickTemplateThemeValue({ light: 'light.svg' }, true), 'light.svg')
  assert.equal(isTemplateImageIconSource('https://cdn.example.com/icon.svg'), true)
  assert.equal(isTemplateImageIconSource('roxy-agent/rx-ic-skills'), false)
})

test('template store items expose the official metadata version', () => {
  const template = officialTemplate('skill', { version: '1.1.2' })

  assert.equal(mapTemplateStoreItem(template, 'en').version, '1.1.2')
})

test('template store items expose approximate execution points', () => {
  const template = officialTemplate('skill', { version: '1.1.2' })
  template.approxPoints = 20

  assert.equal(mapTemplateStoreItem(template, 'zh-CN').approxPoints, 20)
})

test('template store requests can disable backend topped ordering', () => {
  assert.equal(
    serializeTemplateQuery({ labelIds: [4, 9], prioritizeTopped: false }),
    'labelIds=4&labelIds=9&prioritizeTopped=false',
  )
})
