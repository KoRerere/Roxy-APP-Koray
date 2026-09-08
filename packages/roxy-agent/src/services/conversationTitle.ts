interface ConversationTitlePromptOptions {
  messageContent: string
  systemLanguage?: string
}

interface ConversationTitleRetryPromptOptions {
  originalPrompt: string
  generatedContent: unknown
  error: unknown
}

interface GenerateConversationTitleWithRetryOptions<TCandidate> {
  originalPrompt: string
  generate: (prompt: string) => Promise<TCandidate>
  validate: (candidate: TCandidate) => string
  shouldRetry?: (error: unknown) => boolean
}

function formatPromptValue(value: unknown): string {
  if (value === undefined) {
    return '(unavailable: the first attempt did not return parseable content)'
  }

  if (typeof value === 'string') {
    return value
  }

  try {
    return JSON.stringify(value)
  }
  catch {
    return String(value)
  }
}

function formatPromptError(error: unknown): string {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`
  }
  return formatPromptValue(error)
}

export function buildConversationTitlePrompt(options: ConversationTitlePromptOptions): string {
  const systemLanguage = options.systemLanguage?.trim() || 'unknown'
  return [
    'You are a professional conversation title generator.',
    '',
    `System language locale: ${systemLanguage}`,
    'Infer the target title language from the system language locale.',
    'The title must be written in that inferred target language.',
    'Do not translate the title into any other language.',
    'Generate a concise, accurate title for this conversation with no more than 40 characters, based on the user\'s first message.',
    '',
    `User message:\n${options.messageContent}`,
  ].join('\n')
}

export function buildConversationTitleRetryPrompt(options: ConversationTitleRetryPromptOptions): string {
  return [
    options.originalPrompt,
    '',
    'The previous title generation attempt failed validation.',
    `Previous generated content:\n${formatPromptValue(options.generatedContent)}`,
    `Validation error:\n${formatPromptError(options.error)}`,
    'Generate the title again and correct the validation error above. Return only content that matches the required schema.',
  ].join('\n')
}

export async function generateConversationTitleWithRetry<TCandidate>(
  options: GenerateConversationTitleWithRetryOptions<TCandidate>,
): Promise<string> {
  let firstGeneratedContent: TCandidate | undefined

  try {
    firstGeneratedContent = await options.generate(options.originalPrompt)
    return options.validate(firstGeneratedContent)
  }
  catch (error) {
    if (options.shouldRetry && !options.shouldRetry(error)) {
      throw error
    }

    const retryPrompt = buildConversationTitleRetryPrompt({
      originalPrompt: options.originalPrompt,
      generatedContent: firstGeneratedContent,
      error,
    })
    const retryGeneratedContent = await options.generate(retryPrompt)
    return options.validate(retryGeneratedContent)
  }
}
