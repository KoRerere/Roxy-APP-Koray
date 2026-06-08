import type { AiAgentBinaryResponse, AiAgentRequestOptions } from './aiAgentClient'
import { aiAgentClient, resolveAiAgentPath } from './aiAgentClient'

export interface SkillCategory {
  id: number
  slug: string
  name: string | null
  sort_order: number
  enabled: 0 | 1
  created_at: string | null
  updated_at: string | null
}

export interface Skill {
  id: number
  category_id: number
  category_name: string | null
  category_slug: string | null
  slug: string
  name: string
  title: string | null
  description: string | null
  icon_url: string | null
  version: number
  release_notes: string | null
  meta: Record<string, unknown> | null
  file_url: string | null
  published: 0 | 1
  created_at: string | null
  updated_at: string | null
}

export interface UserSkill extends Skill {
  installed_version: number
  has_update: boolean
  installed_at: string | null
  enabled: boolean | 0 | 1
  user_skill_id: number
}

export interface ListSkillsOptions extends AiAgentRequestOptions {
  category?: string
}

export class AiAgentSkillsApi {
  listCategories(options: AiAgentRequestOptions = {}) {
    return aiAgentClient.get<SkillCategory[]>('/v1/skill-categories', options)
  }

  listSkills(options: ListSkillsOptions = {}) {
    const { category, ...requestOptions } = options
    return aiAgentClient.get<Skill[]>('/v1/skills', {
      ...requestOptions,
      query: {
        ...requestOptions.query,
        category,
      },
    })
  }

  getSkill(slug: string, options: AiAgentRequestOptions = {}) {
    return aiAgentClient.get<Skill>(`/v1/skills/${encodeURIComponent(slug)}`, options)
  }

  downloadSkill(slug: string, options: AiAgentRequestOptions = {}): Promise<AiAgentBinaryResponse> {
    return aiAgentClient.download(`/v1/skills/${encodeURIComponent(slug)}/download`, options)
  }

  listUserSkills(options: AiAgentRequestOptions = {}) {
    return aiAgentClient.get<UserSkill[]>('/v1/user/skills', options)
  }

  installSkill(slug: string, options: AiAgentRequestOptions = {}) {
    return aiAgentClient.post<UserSkill>(`/v1/user/skills/${encodeURIComponent(slug)}/install`, options)
  }

  removeInstalledSkill(slug: string, options: AiAgentRequestOptions = {}) {
    return aiAgentClient.delete<null>(`/v1/user/skills/${encodeURIComponent(slug)}`, options)
  }

  setUserSkillEnabled(slug: string, enabled: boolean, options: AiAgentRequestOptions = {}) {
    return aiAgentClient.put<UserSkill>(`/v1/user/skills/${encodeURIComponent(slug)}/enabled`, {
      ...options,
      body: { enabled },
    })
  }

  resolveFileUrl(path?: string | null) {
    return resolveAiAgentPath(path)
  }
}

export const aiAgentSkillsApi = new AiAgentSkillsApi()
