import { describe, expect, it } from 'vitest'
import { applyClarificationOptionSelection, collectStructuredClarificationAnswers } from './clarificationAnswerState'

describe('clarification answer state', () => {
  it('uses the clicked option after the user has typed in the same question input', () => {
    // Regression: option clicks only updated the fallback selection map, while
    // final submission preferred the stale freeform input value.
    // Fixed by: option clicks also replace the active question input value.
    const optionAnswer = '数据采集'
    const nextState = applyClarificationOptionSelection({
      hitlValues: {
        'answer:goal': '我先输入了一段内容',
      },
      selections: {},
      questionId: 'goal',
      answer: optionAnswer,
    })

    expect(collectStructuredClarificationAnswers({
      questions: [{ id: 'goal' }],
      hitlValues: nextState.hitlValues,
      selections: nextState.selections,
    })).toEqual({
      goal: optionAnswer,
    })
  })
})
