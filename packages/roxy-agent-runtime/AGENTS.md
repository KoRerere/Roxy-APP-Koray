# AGENTS.md — roxy-agent Coding Covenant

> This document is the **covenant** every coding agent (Claude Code, Codex, Cursor,
> etc.) must read before working in `roxy-agent`. It states **what we are building**,
> **how the runtime is structured**, and **how to work without polluting the codebase**.
> `ARCHITECTURE.md` describes the codebase; this file describes the _intent and the
> implementation discipline_.

## 0. TDD — the non-negotiable workflow (read this first)

**Every bug fix and every new feature must follow Red → Green order. No exceptions.**

### The cycle

1. **RED** — Write a failing test that reproduces the bug or specifies the new
   behaviour _before_ touching production code. Run it; confirm it fails for the
   right reason.
2. **GREEN** — Write the minimum production code to make that test pass.
3. **VERIFY** — Run the full suite (`pnpm test`) and the type-check
   (`npx tsc --noEmit`). All must be green before the work is considered done.

### Why this matters

A fix without a prior failing test is invisible to the suite. The next unrelated
refactor can silently re-introduce the same bug and no test will catch it. The test
is the permanent memory of what broke and why it is now correct.

### Where tests live

| What you are testing              | Test file pattern                                      |
| --------------------------------- | ------------------------------------------------------ |
| `AgentImpl.invoke` loop behaviour | `test/runtime/invoke.test.ts`                          |
| `AgentImpl.stream` event sequence | `test/runtime/stream.test.ts`                          |
| Provider mapping / protocol       | `test/provider/*.test.ts`                              |
| Tool execution / registry         | `test/tools/*.test.ts`                                 |
| Memory, summarizer, trim          | `test/memory/*.test.ts`                                |
| Bundled CLI config parsing        | `test/config/*.test.ts`                                |
| New module                        | `test/<module>/<file>.test.ts` mirroring `src/` layout |

### Regression comment convention

Every regression test must open with a comment block explaining the original defect:

```typescript
it("short description of the fix", async () => {
  // Regression: <what the old code did wrong and what error it caused>.
  // Fixed by: <one-line description of the fix in production code>.
  …
});
```

### Done definition

A phase or task is **done** when:

- `pnpm test` → all tests pass (including the new one)
- `npx tsc --noEmit` → zero errors
- The new test would **fail** against the pre-fix code (verify via `git stash` if unsure)

## 1. What roxy-agent-runtime is

`roxy-agent-runtime` is a TypeScript **agent framework** (not an application). The public
contract is split by feature under [`src/core/contracts/`](src/core/contracts/) and
re-exported from the zero-dependency compatibility barrel
[`src/core/interfaces.ts`](src/core/interfaces.ts), which existing modules import.

Design pillars (do not violate these):

- **Anthropic-native message protocol.** Messages carry content blocks
  (`text` / `tool_use` / `tool_result`). The system prompt travels **separately** as
  `ChatRequest.system`, never as an in-band message. v1 speaks the Anthropic
  protocol natively; the provider abstraction leaves room for an OpenAI provider
  later **without touching core types** — only a new provider + a converter.
- **Provider-abstracted.** [`IModelProvider`](src/core/interfaces.ts) is the seam.
  `AnthropicProvider` is the real impl; `FakeProvider` is the deterministic test
  impl. Agents depend on the interface, never on a vendor SDK.
- **Failure never kills the loop.** `ToolExecutor.execute`, skill `invoke`,
  `Summarizer.summarize` etc. resolve rather than reject — they return
  `isError: true` results so one bad tool call does not crash the turn.
- **Core runtime fully implemented.** `AgentRuntime.create` in [`src/index.ts`](src/index.ts)
  is wired end-to-end; `AgentRuntime.invoke`, `.stream`, and `.structured` work. The few remaining
  stubs (`TrajectoryBridge.emit`, `replayTrajectory`, subagent parallel graphs)
  are isolated and do not block the main loop. New implementations must still
  **conform to the existing interfaces** — do not bend them to match a library.

## 2. Hard rules for any coding agent

1. **`src/core/contracts/` is the single source of truth for public types;**
   `src/core/interfaces.ts` is re-export-only. Add a contract to the matching
   feature module and re-export new modules from the barrel.
2. **Implement stubs against our interfaces.** When a stub throws
   `NotImplementedError`, understand the existing contract first, then write a
   fresh implementation that conforms to _our_ interface and error-as-result
   conventions. Do not bend the code to match a library.
3. **Respect the Anthropic-native protocol.** System prompt stays top-level;
   content blocks / `tool_use` / `tool_result` are the lingua franca. Only
   providers convert to/from vendor formats.
4. **Match existing code idiom.** 2-space indentation (spaces, not tabs), explicit
   `.ts` extensions on relative imports, `import type` for type-only imports,
   `Record<string, …>` over `{}`. Failure modes return `isError` results; they do
   not throw across the agent boundary.

## 3. Where to start when implementing a stub

- Read [`ARCHITECTURE.md`](ARCHITECTURE.md) for the module map.
- Read the matching feature module under [`src/core/contracts/`](src/core/contracts/)
  for the contract you must satisfy; use [`src/core/interfaces.ts`](src/core/interfaces.ts)
  only as the compatibility/public export index.
- Read the module README and the surrounding tests, then implement in our idiom
  under the corresponding `src/` module.
