import assert from 'node:assert/strict'
// eslint-disable-next-line test/no-import-node-test
import { describe, it } from 'node:test'
import {
  AI_BATCH_CREATE_AGENT_ROUTE,
  AI_BATCH_CREATE_PROMPT_QUERY_VALUE,
  isAiBatchCreatePromptRequest,
  pickAiBatchCreatePrompt,
} from './batch-create-prefill'
import { scanComposerProtocolTokens } from './components/chat-composer/protocol'
import type { OfficialTemplate } from './template-store'
import {
  clearPendingAiBatchCreateGuide,
  getAiBatchCreateGuideStorageKey,
  hasPendingAiBatchCreateGuide,
  hasShownAiBatchCreateGuide,
  isAiBatchCreateGuideForced,
  markAiBatchCreateGuideShown,
  requestAiBatchCreateGuide,
} from './batch-create-guide'

function batchCreateTemplate(): OfficialTemplate {
  return {
    id: 46,
    slug: 'batch-create-profiles',
    templateType: 'prompt',
    name: { en: 'Batch Create Profiles', ru: 'Пакетное создание окон', zh: '批量创建窗口' },
    description: null,
    iconInfo: null,
    sortOrder: 0,
    isHot: true,
    metadata: {
      prompt: {
        en: 'Create profiles. Project: [input:Project](Current Project); Quantity: [input:Quantity]()',
        ru: 'Создать окна. Проект: [input:Проект](Текущий проект); Количество: [input:Количество]()',
        zh: '创建窗口。项目：[input:项目](当前项目)；数量：[input:数量]()',
      },
    },
    labels: [],
    labelIds: [],
    createdAt: null,
    updatedAt: null,
  }
}

describe('AI batch profile creation prefill', () => {
  it('uses the localized prompt returned by the official template API', () => {
    assert.equal(pickAiBatchCreatePrompt([batchCreateTemplate()], 'zh-CN'), '创建窗口。项目：[input:项目](当前项目)；数量：[input:数量]()')
    assert.equal(pickAiBatchCreatePrompt([batchCreateTemplate()], 'en-US'), 'Create profiles. Project: [input:Project](Current Project); Quantity: [input:Quantity]()')
    assert.equal(pickAiBatchCreatePrompt([batchCreateTemplate()], 'ru-RU'), 'Создать окна. Проект: [input:Проект](Текущий проект); Количество: [input:Количество]()')
  })

  it('preserves editable input tokens from the API prompt', () => {
    const prompt = pickAiBatchCreatePrompt([batchCreateTemplate()], 'zh-CN')
    assert.deepEqual(
      scanComposerProtocolTokens(prompt).map(token => token.title),
      ['项目', '数量'],
    )
  })

  it('recognizes scalar and array route query values', () => {
    assert.equal(isAiBatchCreatePromptRequest(AI_BATCH_CREATE_PROMPT_QUERY_VALUE), true)
    assert.equal(isAiBatchCreatePromptRequest([AI_BATCH_CREATE_PROMPT_QUERY_VALUE]), true)
    assert.equal(isAiBatchCreatePromptRequest('other'), false)
  })

  it('opens the Agent home route with the one-time prefill marker', () => {
    assert.equal(AI_BATCH_CREATE_AGENT_ROUTE, '/agent-console?prefill=batch-create-profiles')
  })

  it('stores the guide state separately for each account', () => {
    const values = new Map<string, string>()
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    }

    assert.equal(getAiBatchCreateGuideStorageKey('user@example.com'), 'agent-console:batch-create-guide-shown:user%40example.com')
    assert.equal(hasShownAiBatchCreateGuide('account-a', storage), false)
    markAiBatchCreateGuideShown('account-a', storage)
    assert.equal(hasShownAiBatchCreateGuide('account-a', storage), true)
    assert.equal(hasShownAiBatchCreateGuide('account-b', storage), false)
  })

  it('keeps a guide request pending until the composer consumes it', () => {
    clearPendingAiBatchCreateGuide()
    requestAiBatchCreateGuide()
    assert.equal(hasPendingAiBatchCreateGuide(), true)
    clearPendingAiBatchCreateGuide()
    assert.equal(hasPendingAiBatchCreateGuide(), false)
  })

  it('can force the existing guide when onboarding explicitly requests it', () => {
    clearPendingAiBatchCreateGuide()
    requestAiBatchCreateGuide(true)
    assert.equal(hasPendingAiBatchCreateGuide(), true)
    assert.equal(isAiBatchCreateGuideForced(), true)
    clearPendingAiBatchCreateGuide()
    assert.equal(isAiBatchCreateGuideForced(), false)
  })
})
