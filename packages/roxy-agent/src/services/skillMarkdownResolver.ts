import type { Link, Node, Parent } from 'mdast'
import { fromMarkdown } from 'mdast-util-from-markdown'
import fs from 'node:fs/promises'
import path from 'node:path'
import { agentPaths } from '@/core/storage/agentPaths'
import { ensureRemoteSkillInstalledBySlug } from './templateService'

export interface SkillMarkdownPreloadError {
  title: string
  path: string
  slug?: string
  message: string
}

export interface SkillMarkdownPreloadResult {
  existing: string[]
  downloaded: string[]
  errors: SkillMarkdownPreloadError[]
}

interface SkillMarkdownLink {
  title: string
  path: string
  slug: string
}

const SKILL_MARKDOWN_SUFFIX_PATTERN = /(?:^|\/)library\/skills\/installed\/([^/]+)\/SKILL\.md$/
const SAFE_SKILL_SLUG_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/

function isParent(node: Node): node is Parent {
  return Array.isArray((node as Parent).children)
}

function walk(node: Node, visitor: (node: Node) => void): void {
  visitor(node)
  if (!isParent(node)) {
    return
  }

  for (const child of node.children) {
    walk(child, visitor)
  }
}

function nodeText(node: Node): string {
  if ('value' in node && typeof node.value === 'string') {
    return node.value
  }
  if (!isParent(node)) {
    return ''
  }
  return node.children.map(child => nodeText(child)).join('')
}

function normalizeMarkdownUrl(url: string): string {
  const withoutFragment = url.split('#', 1)[0] ?? ''
  const withoutQuery = withoutFragment.split('?', 1)[0] ?? ''
  try {
    return decodeURI(withoutQuery).replace(/\\/g, '/')
  }
  catch {
    return withoutQuery.replace(/\\/g, '/')
  }
}

function extractInstalledSkillSlug(url: string): string | null {
  const match = SKILL_MARKDOWN_SUFFIX_PATTERN.exec(normalizeMarkdownUrl(url))
  const slug = match?.[1]
  if (!slug || !SAFE_SKILL_SLUG_PATTERN.test(slug)) {
    return null
  }
  return slug
}

function isSkillTokenLink(link: Link): boolean {
  return nodeText(link).trim().startsWith('$')
}

function findSkillMarkdownLinks(message: string): SkillMarkdownLink[] {
  const tree = fromMarkdown(message)
  const links: SkillMarkdownLink[] = []
  walk(tree, (node) => {
    if (node.type !== 'link') {
      return
    }

    const link = node as Link
    if (!isSkillTokenLink(link)) {
      return
    }

    const slug = extractInstalledSkillSlug(link.url)
    if (!slug) {
      return
    }

    links.push({
      title: nodeText(link).trim().replace(/^\$/, ''),
      path: normalizeMarkdownUrl(link.url),
      slug,
    })
  })
  return links
}

function isPathInsideOrEqual(parent: string, target: string): boolean {
  const relative = path.relative(parent, target)
  return parent === target || (relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative))
}

async function isRegularFile(candidate: string): Promise<boolean> {
  const stat = await fs.lstat(candidate).catch(() => null)
  return Boolean(stat?.isFile() && !stat.isSymbolicLink())
}

async function pathExists(candidate: string): Promise<boolean> {
  return fs.lstat(candidate).then(() => true, () => false)
}

async function ensureSkillLinkDownloaded(
  link: SkillMarkdownLink,
  signal?: AbortSignal,
): Promise<{ status: 'existing' | 'downloaded', slug: string }> {
  const installedRoot = path.resolve(agentPaths.skillsInstalledDir)
  const canonicalSkillMdPath = path.resolve(installedRoot, link.slug, 'SKILL.md')
  const linkedPath = path.resolve(link.path)

  if (await pathExists(linkedPath)) {
    if (!isPathInsideOrEqual(installedRoot, linkedPath)) {
      throw new Error('Skill markdown link points outside the installed Skills directory.')
    }
    if (path.basename(linkedPath) !== 'SKILL.md' || !(await isRegularFile(linkedPath))) {
      throw new Error('Skill markdown link must point to a regular SKILL.md file.')
    }
    return { status: 'existing', slug: link.slug }
  }

  if (await isRegularFile(canonicalSkillMdPath)) {
    return { status: 'existing', slug: link.slug }
  }

  await ensureRemoteSkillInstalledBySlug(link.slug, signal)
  return { status: 'downloaded', slug: link.slug }
}

export async function preloadSkillMarkdownLinks(
  message: string,
  signal?: AbortSignal,
): Promise<SkillMarkdownPreloadResult> {
  const result: SkillMarkdownPreloadResult = {
    existing: [],
    downloaded: [],
    errors: [],
  }
  const links = findSkillMarkdownLinks(message)
  const seen = new Set<string>()

  for (const link of links) {
    if (seen.has(link.slug)) {
      continue
    }
    seen.add(link.slug)

    try {
      const preload = await ensureSkillLinkDownloaded(link, signal)
      result[preload.status].push(preload.slug)
    }
    catch (error) {
      result.errors.push({
        title: link.title,
        path: link.path,
        slug: link.slug,
        message: error instanceof Error ? error.message : String(error),
      })
    }
  }

  return result
}
