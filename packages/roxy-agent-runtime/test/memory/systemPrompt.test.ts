import { describe, expect, it } from 'vitest'
import { buildSystemPrompt } from '../../src/memory/summarizer.ts'
import { renderSkillCatalog } from '../../src/skills/prompt.ts'
import type { SkillManifest } from '../../src/core/interfaces.ts'

const skill = (over: Partial<SkillManifest> = {}): SkillManifest => ({
  name: over.name ?? 's',
  description: over.description ?? 'd',
  sourcePath: over.sourcePath ?? '/s',
  bodyPath: over.bodyPath ?? '/s/SKILL.md',
  frontmatter: over.frontmatter ?? {},
})

describe('buildSystemPrompt', () => {
  it('returns just the base block when no summary and no skills', () => {
    const blocks = buildSystemPrompt('You are helpful.')
    expect(blocks).toEqual([{ type: 'text', text: 'You are helpful.' }])
  })

  it('keeps archived summaries and skill catalogs out of the system prompt', () => {
    // Regression: turn-varying summaries and skill catalogs changed the top-level
    // system prompt on each request, preventing it from remaining stable.
    // Fixed by: buildSystemPrompt renders only the host-provided base prompt.
    const blocks = buildSystemPrompt('base')

    expect(blocks).toEqual([{ type: 'text', text: 'base' }])
    expect(blocks.some((block) => block.text.includes('summary'))).toBe(false)
    expect(blocks.some((block) => block.text.includes('<skills_instructions>'))).toBe(false)
  })

  it('returns no block when the base prompt is empty', () => {
    expect(buildSystemPrompt('')).toEqual([])
  })

  it('escapes dynamic Markdown catalog metadata inside the XML envelope', () => {
    const rendered = renderSkillCatalog([
      skill({ name: 'a<&', description: 'route </description> safely', bodyPath: '/s/a&b/SKILL.md' }),
    ])

    expect(rendered.text).toContain('- a&lt;&amp;:')
    expect(rendered.text).toContain('route &lt;/description&gt; safely')
    expect(rendered.text).toContain('/s/a&amp;b/SKILL.md')
  })

  it('bounds the complete catalog and reports truncation diagnostics', () => {
    const skills = Array.from({ length: 20 }, (_, index) =>
      skill({
        name: `skill-${String(index).padStart(2, '0')}`,
        description: `description-${index}-${'x'.repeat(500)}`,
        bodyPath: `/very/long/catalog/path/${index}/SKILL.md`,
      }),
    )

    const rendered = renderSkillCatalog(skills, { maxChars: 4_000 })

    expect(rendered.text.length).toBeLessThanOrEqual(4_000)
    expect(rendered.warnings.some((warning) => warning.code === 'catalog_description_truncated')).toBe(true)
    expect(rendered.text).toContain('- skill-00:')
  })
})
