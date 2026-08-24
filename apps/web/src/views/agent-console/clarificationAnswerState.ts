import type { AgentHitlControlValue } from './types'

interface ClarificationQuestionRef {
  id: string
}

interface ClarificationAnswerState {
  hitlValues: Record<string, AgentHitlControlValue>
  selections: Record<string, string>
}

export function getStructuredClarificationAnswerControlId(questionId: string) {
  return `answer:${questionId}`
}

export function collectStructuredClarificationAnswers({
  questions,
  hitlValues,
  selections,
}: ClarificationAnswerState & {
  questions: ClarificationQuestionRef[]
}): Record<string, string> {
  return Object.fromEntries(questions.map((question) => {
    const value = hitlValues[getStructuredClarificationAnswerControlId(question.id)]
    const freeformAnswer = value === undefined || value === null ? '' : String(value).trim()
    return [
      question.id,
      freeformAnswer || selections[question.id] || '',
    ]
  }))
}

export function applyClarificationOptionSelection({
  hitlValues,
  selections,
  questionId,
  answer,
}: ClarificationAnswerState & {
  questionId: string
  answer: string
}): ClarificationAnswerState {
  const normalizedAnswer = answer.trim()

  return {
    hitlValues: {
      ...hitlValues,
      [getStructuredClarificationAnswerControlId(questionId)]: normalizedAnswer,
    },
    selections: {
      ...selections,
      [questionId]: normalizedAnswer,
    },
  }
}
