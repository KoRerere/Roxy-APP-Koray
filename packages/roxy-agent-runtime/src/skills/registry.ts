import type { ISkillRegistry, SkillDiagnostics, SkillManifest } from '../core/interfaces.ts'
import { scanSkillsWithDiagnostics } from './manifest.ts'

/**
 * SKILL.md-driven registry. Startup scan + manual `reload()` refreshes the
 * manifest cache (no fs.watch). Skill bodies/auxiliary files are loaded on
 * demand by the model via the `read_file` tool (progressive disclosure) — the
 * registry only exposes the manifest metadata plus the skill directory
 * (`sourcePath`/`bodyPath`), which the system prompt advertises.
 */
export class SkillRegistry implements ISkillRegistry {
  private readonly rootDir: string
  private manifests: SkillManifest[] = []
  private latestDiagnostics: SkillDiagnostics = { errors: [], warnings: [] }

  constructor(rootDir: string) {
    this.rootDir = rootDir
  }

  async scan(): Promise<void> {
    const result = await scanSkillsWithDiagnostics(this.rootDir)
    this.manifests = result.skills
    this.latestDiagnostics = { errors: result.errors, warnings: result.warnings }
  }

  async reload(): Promise<void> {
    await this.scan()
  }

  list(): SkillManifest[] {
    return [...this.manifests]
  }

  get(name: string): SkillManifest | undefined {
    return this.manifests.find((m) => m.name === name)
  }

  diagnostics(): SkillDiagnostics {
    return {
      errors: [...this.latestDiagnostics.errors],
      warnings: [...this.latestDiagnostics.warnings],
    }
  }
}
