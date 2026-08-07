import type { Dirent } from "node:fs";
import { opendir, readFile, realpath, stat } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import yaml from "js-yaml";
import type { SkillLoadIssue, SkillManifest, SkillScanResult, SkillValidationResult } from "../core/interfaces.ts";

export const MAX_SKILL_NAME_LENGTH = 64;
export const MAX_SKILL_DESCRIPTION_LENGTH = 1_024;
export const MAX_SKILL_FILE_SIZE = 1024 * 1024;
export const MAX_SKILL_BODY_SIZE = 32 * 1024;
export const MAX_SKILL_ROOT_ENTRIES = 20_000;
export const MAX_SKILL_DIRECTORIES = 2_000;

interface ParsedSkillFile {
  frontmatter?: Record<string, unknown>;
  body: string;
  error?: string;
}

function parseSkillFile(content: string): ParsedSkillFile {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)([\s\S]*)$/);
  if (!match) return { body: content.trim(), error: "SKILL.md must start with YAML frontmatter" };

  try {
    const parsed = yaml.load(match[1]!);
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { body: match[2]!.trim(), error: "SKILL.md frontmatter must be a YAML object" };
    }
    return { frontmatter: parsed as Record<string, unknown>, body: match[2]!.trim() };
  } catch (error) {
    return {
      body: match[2]!.trim(),
      error: `SKILL.md frontmatter is invalid YAML: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

function issue(code: SkillLoadIssue["code"], path: string, message: string): SkillLoadIssue {
  return { code, path, message };
}

/** Validate one SKILL.md for authoring tools and discovery scans. */
export async function validateSkillFile(bodyPath: string): Promise<SkillValidationResult> {
  const requestedPath = resolve(bodyPath);
  let canonicalPath = requestedPath;
  let content: string;

  try {
    const info = await stat(requestedPath);
    if (info.size > MAX_SKILL_FILE_SIZE) {
      return {
        errors: [
          issue(
            "skill_file_too_large",
            requestedPath,
            `SKILL.md is ${info.size} bytes; maximum is ${MAX_SKILL_FILE_SIZE}`,
          ),
        ],
        warnings: [],
      };
    }
    canonicalPath = await realpath(requestedPath);
    content = await readFile(canonicalPath, "utf8");
  } catch (error) {
    return {
      errors: [
        issue(
          "skill_read_failed",
          requestedPath,
          `Could not read SKILL.md: ${error instanceof Error ? error.message : String(error)}`,
        ),
      ],
      warnings: [],
    };
  }

  const parsed = parseSkillFile(content);
  if (!parsed.frontmatter) {
    const code = content.startsWith("---") ? "frontmatter_invalid" : "frontmatter_missing";
    return { errors: [issue(code, canonicalPath, parsed.error ?? "Invalid frontmatter")], warnings: [] };
  }

  const errors: SkillLoadIssue[] = [];
  const rawName = parsed.frontmatter.name;
  const name = rawName === undefined ? basename(dirname(canonicalPath)) : rawName;
  if (typeof name !== "string" || name.trim() === "") {
    errors.push(issue("name_invalid", canonicalPath, "Skill name must be a non-empty string"));
  } else if (name.length > MAX_SKILL_NAME_LENGTH) {
    errors.push(issue("name_too_long", canonicalPath, `Skill name exceeds ${MAX_SKILL_NAME_LENGTH} characters`));
  }

  const description = parsed.frontmatter.description;
  if (description === undefined || (typeof description === "string" && description.trim() === "")) {
    errors.push(issue("description_missing", canonicalPath, "Skill description is required"));
  } else if (typeof description !== "string") {
    errors.push(issue("description_invalid", canonicalPath, "Skill description must be a string"));
  } else if (description.length > MAX_SKILL_DESCRIPTION_LENGTH) {
    errors.push(
      issue(
        "description_too_long",
        canonicalPath,
        `Skill description exceeds ${MAX_SKILL_DESCRIPTION_LENGTH} characters`,
      ),
    );
  }

  if (errors.length > 0 || typeof name !== "string" || typeof description !== "string") {
    return { errors, warnings: [] };
  }

  return {
    skill: {
      name,
      description,
      sourcePath: dirname(canonicalPath),
      bodyPath: canonicalPath,
      frontmatter: parsed.frontmatter,
    },
    errors: [],
    warnings: [],
  };
}

/** Scan direct child directories and retain bounded, structured diagnostics. */
export async function scanSkillsWithDiagnostics(rootDir: string): Promise<SkillScanResult> {
  const root = resolve(rootDir);
  const entries: Dirent[] = [];
  const warnings: SkillLoadIssue[] = [];
  try {
    const directory = await opendir(root);
    for await (const entry of directory) {
      if (entries.length === MAX_SKILL_ROOT_ENTRIES) {
        warnings.push(
          issue(
            "root_entry_limit_reached",
            root,
            `Skill root has more than ${MAX_SKILL_ROOT_ENTRIES} entries; remaining entries were not scanned`,
          ),
        );
        break;
      }
      entries.push(entry);
    }
  } catch {
    return { skills: [], errors: [], warnings: [] };
  }

  let directories = entries.filter((entry) => entry.isDirectory()).toSorted((a, b) => a.name.localeCompare(b.name));
  if (directories.length > MAX_SKILL_DIRECTORIES) {
    warnings.push(
      issue(
        "skill_directory_limit_reached",
        root,
        `Skill root has more than ${MAX_SKILL_DIRECTORIES} directories; remaining directories were not scanned`,
      ),
    );
    directories = directories.slice(0, MAX_SKILL_DIRECTORIES);
  }

  const results: SkillValidationResult[] = [];
  for (let offset = 0; offset < directories.length; offset += 64) {
    const batch = directories.slice(offset, offset + 64);
    const loaded = await Promise.all(
      batch.map(async (entry) => {
        const bodyPath = join(root, entry.name, "SKILL.md");
        try {
          await stat(bodyPath);
        } catch {
          return undefined;
        }
        return validateSkillFile(bodyPath);
      }),
    );
    results.push(...loaded.filter((result): result is SkillValidationResult => result !== undefined));
  }

  const skills = results
    .flatMap((result) => (result.skill ? [result.skill] : []))
    .toSorted((a, b) => a.name.localeCompare(b.name) || a.bodyPath.localeCompare(b.bodyPath));
  const errors = results.flatMap((result) => result.errors).toSorted((a, b) => a.path.localeCompare(b.path));
  warnings.push(...results.flatMap((result) => result.warnings));
  return { skills, errors, warnings };
}

/** Compatibility helper for callers that only need valid manifests. */
export async function scanSkills(rootDir: string): Promise<SkillManifest[]> {
  return (await scanSkillsWithDiagnostics(rootDir)).skills;
}

async function readBoundedSkillFile(manifest: SkillManifest): Promise<{ raw: string; parsed: ParsedSkillFile }> {
  const info = await stat(manifest.bodyPath);
  if (info.size > MAX_SKILL_BODY_SIZE) {
    throw new Error(`Skill '${manifest.name}' body exceeds MAX_SKILL_BODY_SIZE (${MAX_SKILL_BODY_SIZE} bytes)`);
  }
  const raw = await readFile(manifest.bodyPath, "utf8");
  const parsed = parseSkillFile(raw);
  if (!parsed.frontmatter) throw new Error(parsed.error ?? `Skill '${manifest.name}' has invalid frontmatter`);
  return { raw, parsed };
}

/** Load the bounded Markdown body after strict discovery validation. */
export async function loadSkillBody(manifest: SkillManifest): Promise<string> {
  return (await readBoundedSkillFile(manifest)).parsed.body;
}

/** Load the complete bounded SKILL.md for contextual prompt injection. */
export async function loadSkillFile(manifest: SkillManifest): Promise<string> {
  return (await readBoundedSkillFile(manifest)).raw;
}
