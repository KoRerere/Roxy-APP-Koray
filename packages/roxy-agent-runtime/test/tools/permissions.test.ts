import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { PathPermissions, DEFAULT_DENY_PATTERNS } from '../../src/tools/builtin/permissions.ts'

function tmpRoot() {
  return mkdtempSync(join(tmpdir(), 'roxy-perm-'))
}

describe('PathPermissions', () => {
  describe('checkPath (allow/deny)', () => {
    it('allows a path inside an allow root', () => {
      const root = tmpRoot()
      const p = new PathPermissions({ allowRoots: [root] })
      expect(p.checkPath(join(root, 'a.txt'))).toBe('allow')
    })

    it('allows nested paths inside an allow root', () => {
      const root = tmpRoot()
      const p = new PathPermissions({ allowRoots: [root] })
      expect(p.checkPath(join(root, 'sub', 'deep', 'file.md'))).toBe('allow')
    })

    it('denies a path outside all allow roots', () => {
      const root = tmpRoot()
      const outside = tmpRoot()
      const p = new PathPermissions({ allowRoots: [root] })
      expect(p.checkPath(join(outside, 'x.txt'))).toBe('deny')
    })

    it('denies traversal that escapes an allow root', () => {
      const root = tmpRoot()
      const p = new PathPermissions({ allowRoots: [root] })
      expect(p.checkPath(join(root, '..', 'secret.txt'))).toBe('deny')
    })

    it('honours multiple allow roots', () => {
      const a = tmpRoot()
      const b = tmpRoot()
      const p = new PathPermissions({ allowRoots: [a, b] })
      expect(p.checkPath(join(a, 'x'))).toBe('allow')
      expect(p.checkPath(join(b, 'y'))).toBe('allow')
    })

    it('denies an allow-root path that matches the deny list', () => {
      const root = tmpRoot()
      const p = new PathPermissions({ allowRoots: [root] })
      expect(p.checkPath(join(root, '.env'))).toBe('deny')
      expect(p.checkPath(join(root, 'deploy', 'id_rsa'))).toBe('deny')
      expect(p.checkPath(join(root, 'cert.pem'))).toBe('deny')
    })

    it('unrestricted (no allowRoots) → allow everything except deny', () => {
      const p = new PathPermissions({ allowRoots: [] })
      expect(p.checkPath('/tmp/anything.txt')).toBe('allow')
      // deny still applies when patterns are present
      expect(p.checkPath('/tmp/.env')).toBe('deny')
    })
  })

  describe('classify (allow/ask/deny)', () => {
    it('allow → inside an allow root', () => {
      const root = tmpRoot()
      const p = new PathPermissions({ allowRoots: [root] })
      expect(p.classify(join(root, 'a.txt'))).toBe('allow')
    })

    it('deny → matches deny pattern even inside root', () => {
      const root = tmpRoot()
      const p = new PathPermissions({ allowRoots: [root] })
      expect(p.classify(join(root, '.env'))).toBe('deny')
    })

    it('ask → outside roots, not a deny pattern', () => {
      const root = tmpRoot()
      const outside = tmpRoot()
      const p = new PathPermissions({ allowRoots: [root] })
      expect(p.classify(join(outside, 'readme.md'))).toBe('ask')
    })

    it('ask never returns when unrestricted (outside + no roots → allow)', () => {
      const p = new PathPermissions({ allowRoots: [] })
      expect(p.classify('/tmp/readme.md')).toBe('allow')
    })
  })

  describe('config overrides', () => {
    it('disableDefaultDeny turns off default deny patterns', () => {
      const root = tmpRoot()
      const p = new PathPermissions({ allowRoots: [root], disableDefaultDeny: true })
      expect(p.checkPath(join(root, '.env'))).toBe('allow')
    })

    it('extra deny patterns append, extraAllowRoots extend', () => {
      const root = tmpRoot()
      const p = new PathPermissions({
        allowRoots: [root],
        extraDeny: ['**/secrets.json'],
        extraAllowRoots: [tmpRoot()],
      })
      const second = p.classify(join(root, '.env')) // still default-deny
      expect(second).toBe('deny')
    })

    it('exposes the default deny list', () => {
      expect(DEFAULT_DENY_PATTERNS).toContain('.env')
      expect(DEFAULT_DENY_PATTERNS.some((p) => p.includes('pem'))).toBe(true)
    })
  })
})
