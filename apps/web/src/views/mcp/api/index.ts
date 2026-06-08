import { HttpClient, SkillsApi, UserApi } from '@roxy/agent-api'
import { createHttpClient } from '/@/api'

const httpClient = createHttpClient(HttpClient, (config) => {
  config.headers.Authorization ||= config.headers.token ? `Bearer ${config.headers.token}` : undefined
  config.baseURL = `${config.baseURL}/llm-proxy`
  return config
})

export const AgentAPI = {
  skills: new SkillsApi(httpClient),
  user: new UserApi(httpClient),
}
