# Waiting and Timing

Waiting is mandatory after navigation or actions that change the page.

## Recommended Pattern
1. Action that changes state (`browser_navigate`, `browser_click`, submit)
2. `browser_wait_for` to allow render or network completion
3. `browser_snapshot` to refresh refs

## Use the Right Wait
- Use `text` when waiting for specific content to appear.
- Use `textGone` when waiting for spinners or loading labels to disappear.
- Use `time` for a simple buffer when no stable text is available (start with 2 seconds).

## Common Pitfalls
- Interacting immediately after navigation (refs become stale).
- Reusing old refs after DOM changes.
