# Snapshot Modes Guide

Two snapshot modes control how page elements are identified:

- ARIA mode (default): elements identified by `ref` string (e.g. "e48")
- Optimized mode: elements identified by `mcpId` number (e.g. 42)

## ARIA Mode (`--snapshot-optimization-mode aria`)

### How it works

- Uses Playwright's built-in accessibility tree (`_snapshotForAI()`)
- Returns YAML-formatted ARIA tree with `[ref=eXX]` attributes
- Supports incremental snapshots (diffs)
- More comprehensive — includes all accessible elements

### Snapshot output example

```yaml
- search [ref=e42]:
    - textbox "Search..." [ref=e48]:
        - /placeholder: "Search..."
    - button "Submit" [ref=e50]
- navigation [ref=e60]:
    - link "Home" [ref=e61]
    - link "About" [ref=e62]
```

### How to interact

- ALWAYS use the `ref` parameter (string)
- Copy the ref value EXACTLY as shown (e.g. "e48", NOT 48)
- NEVER use the `mcpId` parameter in ARIA mode

### Tool call examples

- `browser_click(ref="e50")` — click the Submit button
- `browser_type(ref="e48", text="hello")` — type into search box
- `browser_type(ref="e48", text="query", submit=true)` — type and press Enter
- `browser_select_option(ref="e70", values=["option1"])`

### Common mistakes

| Wrong      | Right       | Why                           |
| ---------- | ----------- | ----------------------------- |
| `mcpId=48` | `ref="e48"` | ARIA mode uses ref, not mcpId |
| `ref=48`   | `ref="e48"` | ref includes the "e" prefix   |
| `ref="48"` | `ref="e48"` | Must include the "e" prefix   |

## Optimized Mode (`--snapshot-optimization-mode optimized`)

### How it works

- Custom DOM distillation via `captureOptimizedSnapshot()`
- Returns simplified HTML with `mcpId` attributes
- Viewport-aware — only includes visible interactive elements
- Smaller output, fewer tokens

### Snapshot output example

```html
<button mcpId="1" role="button">Submit</button>
<input mcpId="2" type="text" name="search" />
<a mcpId="3">Home</a>
<a mcpId="4">About</a>
```

### How to interact

- ALWAYS use the `mcpId` parameter (number)
- Use the exact numeric value shown (e.g. 1, 2, 3)
- NEVER use the `ref` parameter in optimized mode

### Tool call examples

- `browser_click(mcpId=1)` — click the Submit button
- `browser_type(mcpId=2, text="hello")` — type into search input
- `browser_type(mcpId=2, text="query", submit=true)` — type and press Enter

### Common mistakes

| Wrong       | Right     | Why                                |
| ----------- | --------- | ---------------------------------- |
| `ref="e1"`  | `mcpId=1` | Optimized mode uses mcpId, not ref |
| `mcpId="1"` | `mcpId=1` | mcpId is a number, not a string    |

## Auto Mode (`--snapshot-optimization-mode auto`)

- Tries optimized mode first, falls back to ARIA on error
- Check the snapshot response header to determine which mode was used:
  - "Page Snapshot (Optimized Mode)" → use `mcpId`
  - "Snapshot" with YAML → use `ref`

## Configuration

Set via CLI flag: `--snapshot-optimization-mode <aria|optimized|auto>`

## Key Rules (Both Modes)

1. ALWAYS call `browser_snapshot()` before interacting with elements.
2. ALWAYS re-snapshot after navigation or DOM changes — refs/mcpIds go stale.
3. NEVER reuse element identifiers from a previous snapshot.
4. If interaction fails, re-snapshot and retry with fresh identifiers.
