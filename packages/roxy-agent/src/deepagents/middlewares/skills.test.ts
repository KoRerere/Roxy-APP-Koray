import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'vitest'
import { env } from '@/config'
import { buildSkillsSystemPrompt } from './skills'

const originalSystemLanguage = env.SYSTEM_LANGUAGE

afterEach(() => {
  env.SYSTEM_LANGUAGE = originalSystemLanguage
})

describe('build skills system prompt', () => {
  it('injects available Skills as XML with an optional ref in Chinese', () => {
    env.SYSTEM_LANGUAGE = 'zh-CN'

    const prompt = buildSkillsSystemPrompt([{
      name: 'template-skill',
      description: 'Template Skill description',
      ref: 'official:42',
    }, {
      name: 'local-skill',
      description: 'Local Skill description',
    }])

    assert.match(prompt, /<available-skills>/)
    assert.match(prompt, /<name>template-skill<\/name>/)
    assert.match(prompt, /<description>Template Skill description<\/description>/)
    assert.match(prompt, /<ref>official:42<\/ref>/)
    assert.match(prompt, /<name>local-skill<\/name>/)
    assert.match(prompt, /- `name`: Skill 名称。/)
    assert.match(prompt, /- `description`: Skill 的用途说明。/)
    assert.match(prompt, /- `ref`: 官方或用户 Skill 模板的 canonical 引用/)
    assert.ok(prompt.indexOf('- `name`') < prompt.indexOf('<available-skills>'))
    assert.match(prompt, /<available-skills>\n {2}<skill>\n {4}<name>template-skill<\/name>/)
    assert.doesNotMatch(prompt, /load_skill_file/)
    assert.doesNotMatch(prompt, /SKILL\.md/)
    assert.doesNotMatch(prompt, /如何|先读|分页|不搜索/)
  })

  it('injects available Skills as XML with a ref explanation in English', () => {
    env.SYSTEM_LANGUAGE = 'en'

    const prompt = buildSkillsSystemPrompt([{
      name: 'template-skill',
      description: 'Template Skill description',
      ref: 'user:84',
    }])

    assert.match(prompt, /<available-skills>/)
    assert.match(prompt, /<name>template-skill<\/name>/)
    assert.match(prompt, /<ref>user:84<\/ref>/)
    assert.match(prompt, /- `name`: The Skill name\./)
    assert.match(prompt, /- `description`: A brief description of what the Skill is for\./)
    assert.match(prompt, /- `ref`: The canonical reference for an official or user Skill template/)
    assert.ok(prompt.indexOf('- `name`') < prompt.indexOf('<available-skills>'))
    assert.match(prompt, /<description>Template Skill description<\/description>\n {4}<ref>user:84<\/ref>/)
    assert.doesNotMatch(prompt, /load_skill_file/)
    assert.doesNotMatch(prompt, /SKILL\.md/)
    assert.doesNotMatch(prompt, /Rules:|Tips:|pagination|template catalog/)
  })

  it('escapes frontmatter values so they cannot break the XML structure', () => {
    env.SYSTEM_LANGUAGE = 'en'

    const prompt = buildSkillsSystemPrompt([{
      name: 'research<&>"\'',
      description: 'Use <carefully> & verify',
    }])

    assert.match(prompt, /<name>research&lt;&amp;&gt;&quot;&apos;<\/name>/)
    assert.match(prompt, /<description>Use &lt;carefully&gt; &amp; verify<\/description>/)
  })

  it('keeps a valid empty XML container when no Skills are available', () => {
    env.SYSTEM_LANGUAGE = 'en'

    const prompt = buildSkillsSystemPrompt([])

    assert.match(prompt, /<available-skills>\n<\/available-skills>/)
  })
})
