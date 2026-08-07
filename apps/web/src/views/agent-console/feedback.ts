import type { FeedbackInfo, UploadedFileInfo } from '@roxy/agent-api'

export const MAX_FEEDBACK_IMAGES = 9

export interface FeedbackImageCandidate {
  lastModified: number
  name: string
  size: number
  type: string
}

export interface FeedbackImageSelection<T extends FeedbackImageCandidate> {
  accepted: T[]
  duplicateCount: number
  invalidCount: number
  overflowCount: number
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function feedbackImageKey(file: FeedbackImageCandidate): string {
  return [file.name, file.size, file.lastModified].join(':')
}

export function selectFeedbackImages<T extends FeedbackImageCandidate>(
  existing: readonly T[],
  candidates: readonly T[],
  limit = MAX_FEEDBACK_IMAGES,
): FeedbackImageSelection<T> {
  const accepted: T[] = []
  const knownFiles = new Set(existing.map(feedbackImageKey))
  let duplicateCount = 0
  let invalidCount = 0
  let overflowCount = 0

  for (const candidate of candidates) {
    if (!candidate.type.toLowerCase().startsWith('image/')) {
      invalidCount += 1
      continue
    }

    const key = feedbackImageKey(candidate)
    if (knownFiles.has(key)) {
      duplicateCount += 1
      continue
    }

    if (existing.length + accepted.length >= limit) {
      overflowCount += 1
      continue
    }

    knownFiles.add(key)
    accepted.push(candidate)
  }

  return {
    accepted,
    duplicateCount,
    invalidCount,
    overflowCount,
  }
}

export function readFeedbackUpload(response: unknown, fallbackMessage: string): UploadedFileInfo {
  if (!isRecord(response) || response.code !== 0 || !isRecord(response.data))
    throw new Error(isRecord(response) && typeof response.message === 'string' ? response.message : fallbackMessage)

  const data = response.data
  if (
    typeof data.file_id !== 'string'
    || typeof data.content_type !== 'string'
    || typeof data.size !== 'number'
    || typeof data.url !== 'string'
  ) {
    throw new TypeError(fallbackMessage)
  }

  return data as unknown as UploadedFileInfo
}

export function readFeedbackSubmission(response: unknown, fallbackMessage: string): FeedbackInfo {
  if (!isRecord(response) || response.code !== 0 || !isRecord(response.data))
    throw new Error(isRecord(response) && typeof response.message === 'string' ? response.message : fallbackMessage)

  if (typeof response.data.id !== 'number')
    throw new TypeError(fallbackMessage)

  return response.data as unknown as FeedbackInfo
}

export function getFeedbackErrorMessage(error: unknown, fallbackMessage: string): string {
  if (isRecord(error)) {
    const response = isRecord(error.response) ? error.response : undefined
    const data = response && isRecord(response.data) ? response.data : undefined
    if (data && typeof data.message === 'string' && data.message.trim())
      return data.message

    if (typeof error.message === 'string' && error.message.trim())
      return error.message
  }

  return fallbackMessage
}

export function resolveFeedbackPlatform(
  source: Pick<Navigator, 'platform' | 'userAgent'> & {
    userAgentData?: { platform?: string }
  },
): string | undefined {
  const platform = source.userAgentData?.platform?.trim()
    || source.platform?.trim()
    || source.userAgent?.trim()

  return platform ? platform.slice(0, 64) : undefined
}
