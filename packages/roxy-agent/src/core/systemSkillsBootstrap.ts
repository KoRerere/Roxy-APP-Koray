import { systemSkillsContentSha512, systemSkillsZipBase64 } from 'virtual:roxy-system-skills-zip'
import { agentPaths } from '@/core/storage/agentPaths'
import { restoreSystemSkillsBundle } from './systemSkillsBundle'

export async function ensureBundledSystemSkills(): Promise<void> {
  try {
    await restoreSystemSkillsBundle(
      systemSkillsZipBase64,
      agentPaths.skillsBuiltinDir,
      systemSkillsContentSha512,
    )
  }
  catch (error) {
    console.warn(
      '[system-skills] Failed to restore bundled system Skills:',
      error instanceof Error ? error.message : String(error),
    )
  }
}
