---
name: roxy-template-creator
description: Create or update a reusable Roxy Agent skill template from a completed task, task report, or user-described workflow. Use when the user asks to save a task as a template, turn or convert a task into a reusable template or skill, create or update an agent skill, including requests such as “保存为模板”, “转成模板”, “做成模板”, or “创建 skill”. Produce a generalized SKILL.md, companion Composer prompt, optional Roxy Agent automation scripts, and validation artifacts.
---

# Roxy Agent Skill Template Creator

Create a focused, reusable Roxy Agent skill template that Roxy Agent can upload, install, discover, and run with a companion prompt.

## Required Deliverables

Produce all of the following:

1. A Skill package directory whose root contains `SKILL.md`.
2. A ZIP archive whose archive root contains `SKILL.md` and the package resources.
3. A non-empty companion prompt for the template's `metadata.prompt` field.
4. A short validation report covering structure, prompt tokens, and any bundled automation script.

Keep the package and companion prompt as separate deliverables. Adding a prompt file to the ZIP does not populate `metadata.prompt`.

Do not upload, publish, install, or claim persistence unless the user asks for that action and an available tool confirms it.

## Core Principles

- Assume the agent already has general reasoning and writing ability. Add instructions that change task decisions, preserve domain rules, or prevent realistic failures.
- Preserve the user's requested product, workflow, scope, and authorization. A Skill cannot grant extra filesystem, command, browser, network, or approval permissions.
- Match detail to risk. Open-ended analysis should describe outcomes and decision criteria; fragile or repeatable operations may use explicit steps or deterministic scripts.
- Keep discovery precise. The frontmatter description must say what the Skill does and when it applies without attracting unrelated tasks.
- Use progressive disclosure. Keep shared guidance in `SKILL.md`; place conditional detail in `references/`; place executable helpers and Roxy automation scripts in `scripts/`; place output templates or media in `assets/`.
- Create only resources with a concrete use. Do not add placeholder directories, duplicated guides, changelogs, or installation documentation.

## Package Structure

Use the smallest structure that supports the workflow:

```text
skill-name/
|-- SKILL.md                 Required instructions and routing
|-- scripts/                 Optional helpers or Roxy Agent automation scripts
|-- references/              Optional task-specific documentation
`-- assets/                  Optional files copied or adapted into output
```

The upload archive may contain `SKILL.md` at the archive root or inside one top-level directory. Prefer `SKILL.md` at the archive root so the package is already in its normalized installed shape.

Do not include `.DS_Store`, `__MACOSX`, `._*`, symlinks, absolute paths, `..` path segments, dependency caches, or generated files unrelated to the Skill.

## Frontmatter

Write canonical, single-line YAML scalars for the required fields:

```yaml
---
name: competitor-research
description: Research a competitor through RoxyBrowser when the user needs a sourced product, market, or positioning analysis.
---
```

Requirements:

- `name` must match the package directory name.
- Use lowercase letters, digits, and single hyphens only.
- Do not start or end with a hyphen or use consecutive hyphens.
- Keep `name` at 64 characters or fewer.
- Keep `description` non-empty and at 1024 characters or fewer.
- Keep `SKILL.md` under 32 KiB; move conditional detail into routed references.
- Explain both capability and activation conditions in `description`.
- Preserve meaningful extra frontmatter when updating an existing Skill.

## Writing SKILL.md

Write instructions for another Roxy agent to perform the task well:

- State the desired outcome, non-obvious context, real constraints, and verification criteria.
- Distinguish required behavior from recommendations and examples.
- Route to each supporting file where it becomes relevant and explain why it should be read.
- Avoid copying general manuals or restating Roxy system policies.
- Keep examples only when they clarify a decision, data shape, or fragile operation.
- Define stopping conditions for retries, destructive actions, and externally mutating workflows.

When updating an existing package, inspect its current callers and resources first. Preserve unrelated instructions, files, and frontmatter.

## Companion Prompt

Every Roxy Agent skill template must include a useful companion prompt. Roxy Agent stores it separately as `metadata.prompt` and appends it after the installed Skill reference when the user expands the template in Composer.

The companion prompt should describe the immediate task and expose only the inputs the user should fill. Do not repeat the full Skill instructions. Do not add a `[$Skill](...)` token: Roxy inserts the installed Skill reference automatically.

Supported Composer input tokens include:

```text
[input:Keyword]()
[input:Report date](今天日期)
[url:Target site](https://example.com)
```

- `[input:Label](default)` creates a text input. Leave the target empty when the user must provide it.
- `[url:Label](default)` creates a URL input.
- Use the exact default `今天日期` when an input should resolve to the user's local date when the template opens.
- Avoid `]` inside labels and `)` inside token values because they terminate the serialized token.
- Keep normal Markdown links separate from Composer tokens.

Generalize the companion prompt for later runs:

- Keep the companion prompt independent of browser windows. Describe browser work as operating on the windows selected by the user when they use the template.
- Replace per-run text, dates, counts, and similar values with `[input:...]` tokens.
- Replace configurable target URLs with `[url:...]` tokens.
- Do not retain concrete `dirId` values, account usernames, one-time order identifiers, or temporary local paths unless the user explicitly asks to fix that value in the template.
- Do not place passwords, cookies, access tokens, API keys, or other secrets in the prompt or token defaults.
- Use only `input` and `url` Composer tokens. Do not use `@profile`, `{{variable}}`, `$VARIABLE`, `${VARIABLE}`, `@script`, or Skill-reference tokens as substitutes.

Example companion prompt:

```text
Research [input:Competitor name]() at [url:Website](). Compare positioning, pricing, and customer evidence in the browser windows selected by the user, then produce a sourced Markdown report.
```

## Bundled Scripts

There are two distinct script kinds.

### Node Helpers

Use a Node helper for deterministic package operations such as validation or data conversion. Keep it dependency-free unless every required dependency is bundled in the Skill. Run it through `exec_command`; normal command permissions, approval, timeout, and output limits still apply.

### Roxy Automation Scripts

When the requested Skill contains a consecutive, stable, reusable sequence of browser operations, consider extracting that sequence into `scripts/<slug>.ts`.

Before authoring or modifying that script, load the available `automation-script-writing` Skill and follow its complete `SKILL.md`. It defines the self-describing TypeScript contract, `defineMetadata`, `defineParams`, exported `main`, sandbox imports, browser connection, permissions, parameter handling, and debugging workflow.

Inside this Skill's instructions:

- Refer to the bundled automation script by its path relative to `SKILL.md`.
- At runtime, resolve that file to an absolute installed path.
- Call `roxy_script_describe` before building parameters.
- Call `roxy_script_run` with the same absolute path, selected `dirIds`, and validated parameters.
- Do not serialize the bundled local script as an `[@script:...](...)` Composer token. That token represents a separately persisted Script template reference.
- Keep judgment, interpretation, and open-ended analysis in the Skill. Extract only the repeatable browser-operation segment.

Do not create an automation script merely because the workflow uses a browser. A short, changing, or primarily investigative interaction is usually clearer as direct Skill guidance.

## Workflow

1. Confirm the requested use cases, outputs, inputs, risk boundaries, and representative examples.
2. Inspect an existing package before editing it. For a new package, choose a short action-oriented name and the minimum resource structure.
3. Write `SKILL.md` with precise discovery metadata, shared instructions, and conditional resource routing.
4. Write the required companion prompt using Composer tokens where user input is needed; leave browser-window selection to the Composer or task-creation flow.
5. If a reusable browser-operation sequence exists, load `automation-script-writing`, create the self-describing script, and route to it from `SKILL.md`.
6. Save the companion prompt to a temporary plain-text file outside the package, then run the bundled Skill and Composer prompt validator:

   ```bash
   node --experimental-strip-types <roxy-template-creator-dir>/scripts/quick_validate.ts \
     <skill-directory-or-SKILL.md> \
     --prompt-file <companion-prompt.txt>
   ```

7. If an automation script was added, inspect it with `roxy_script_describe` and run it with `roxy_script_run` when the required browser and authorization are available.
8. Create the ZIP with the Skill contents at the archive root, then inspect the archive listing for layout, unsafe paths, and unwanted files.
9. Report the package path, ZIP path, companion prompt, completed checks, and any validation that still requires a real browser or upload flow.

## Validation Boundaries

`scripts/quick_validate.ts` checks the canonical frontmatter profile produced by this Skill, naming, required fields, body presence, unfinished TODO placeholders, and the companion prompt's supported Composer syntax. It intentionally has no package dependencies so the installed system Skill can run it with Node.

The validator does not prove instruction quality, full YAML compatibility, visual Composer rendering, ZIP upload acceptance, or automation behavior. Validate those separately through review, archive inspection, Composer tests when available, and `roxy_script_describe` / `roxy_script_run` for bundled automation scripts.

Improve the template from observed usage or demonstrated failures. Prefer a narrow correction over accumulating universal rules from isolated examples.
