interface ConversationTitlePromptOptions {
  messageContent: string
  systemLanguage?: string
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
    'Generate a concise, accurate title for this conversation based on the user\'s first message.',
    '',
    `User message:\n${options.messageContent}`,
  ].join('\n')
}
