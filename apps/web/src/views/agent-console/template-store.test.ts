import assert from 'node:assert/strict'
import test from 'node:test'
import {
  isTemplateImageIconSource,
  pickOfficialTemplatePrompt,
  pickTemplateThemeValue,
  type OfficialTemplate,
} from './template-store'

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

test('template icon helpers share theme fallback and image detection', () => {
  const pair = { light: 'light.svg', dark: 'dark.svg' }

  assert.equal(pickTemplateThemeValue(pair, false), 'light.svg')
  assert.equal(pickTemplateThemeValue({ light: 'light.svg' }, true), 'light.svg')
  assert.equal(isTemplateImageIconSource('https://cdn.example.com/icon.svg'), true)
  assert.equal(isTemplateImageIconSource('roxy-agent/rx-ic-skills'), false)
})
