// ---------------------------------------------------------------------------
// Skills (SKILL.md model-driven)
// ---------------------------------------------------------------------------

/**
 * A discovered skill: a directory containing a SKILL.md (YAML frontmatter +
 * Markdown body) plus optional scripts/resources.
 *
 * Skills are NOT ToolHandlers directly. Only metadata is exposed up-front in
 * the system catalog. An explicitly selected skill injects its complete
 * SKILL.md for that turn; otherwise the model loads it and auxiliary files on
 * demand via the built-in `read_file` tool (progressive disclosure).
 */
export interface SkillManifest {
  name: string;
  description: string;
  /** Absolute path of the skill directory. */
  sourcePath: string;
  /** Path to the SKILL.md file. */
  bodyPath: string;
  /** Parsed YAML frontmatter. */
  frontmatter: Record<string, unknown>;
}

export type SkillLoadIssueCode =
  | "frontmatter_missing"
  | "frontmatter_invalid"
  | "name_invalid"
  | "name_too_long"
  | "description_missing"
  | "description_invalid"
  | "description_too_long"
  | "skill_file_too_large"
  | "skill_read_failed"
  | "root_entry_limit_reached"
  | "skill_directory_limit_reached";

export interface SkillLoadIssue {
  code: SkillLoadIssueCode;
  path: string;
  message: string;
}

export interface SkillDiagnostics {
  errors: SkillLoadIssue[];
  warnings: SkillLoadIssue[];
}

export interface SkillValidationResult extends SkillDiagnostics {
  skill?: SkillManifest;
}

export interface SkillScanResult extends SkillDiagnostics {
  skills: SkillManifest[];
}

/** Stable identity for a skill explicitly selected for one agent turn. */
export interface SkillSelection {
  name: string;
  /** Absolute path to the selected entry's SKILL.md. */
  path: string;
}

export interface ISkillRegistry {
  /** Scan the configured skills directory (initial load). */
  scan(): Promise<void>;
  /** Re-scan and refresh the manifest cache. */
  reload(): Promise<void>;
  list(): SkillManifest[];
  get(name: string): SkillManifest | undefined;
  diagnostics(): SkillDiagnostics;
}
