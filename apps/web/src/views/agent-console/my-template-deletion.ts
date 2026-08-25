import type { MyTemplateItem } from './my-templates'
import { readSkillSlugFromMetadata } from './components/chat-composer/templateItems'

export interface MyTemplateDeletionDependencies {
  deleteInstalledSkill: (slug: string) => Promise<unknown>
  deleteRemoteTemplate: (templateId: number) => Promise<void>
}

export async function deleteMyTemplate(
  item: MyTemplateItem,
  dependencies: MyTemplateDeletionDependencies,
): Promise<void> {
  if (item.kind === 'skill') {
    const slug = readSkillSlugFromMetadata(item.metadata)
    if (slug) {
      await dependencies.deleteInstalledSkill(slug)
    }
  }

  await dependencies.deleteRemoteTemplate(item.id)
}
