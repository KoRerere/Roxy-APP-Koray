# Error Handling Guide

Use this guide when automation fails or behavior is unexpected.

## Browser Not Connected

- Connect first with `roxy_browser_connect`.
- Use `endpoint`, not `cdpEndpoint`.
- For Chrome, use a CDP WebSocket URL like `ws://127.0.0.1:PORT/devtools/browser/...`.
- For Firefox, use a BiDi WebSocket endpoint.
- If you are connecting to Firefox, explicitly set `browserCore: "Firefox"` when needed.

## Browser Connection Failed

- Verify the endpoint is still live.
- Check that the endpoint type matches the browser:
  - Chrome -> CDP WebSocket endpoint
  - Firefox -> BiDi WebSocket endpoint
- If the browser was restarted, reconnect with `roxy_browser_connect`.

## Element Not Found

- Re-run `browser_snapshot`.
- Ask the user for a clearer element description (label text, role, nearby text).
- Verify you are on the expected page and state.

## Dialogs Block Actions

- Use `browser_handle_dialog` (accept or dismiss) before continuing.

## Page Not Loading

- Use `browser_wait_for(time=2)` and re-snapshot.
- Inspect `browser_console_messages` and `browser_network_requests`.

## Network or JS Errors

- Check for failed requests and console exceptions.
- If errors persist, ask the user for expected outcome and current page URL.

## "Either ref or mcpId must be provided"

- You called an interaction tool without specifying which element to target.
- Call `browser_snapshot()` first, then use `ref` (ARIA mode) or `mcpId` (optimized mode) from the snapshot.

## "Element with mcpId X not found"

- You likely used `mcpId` but the page is in ARIA snapshot mode.
- Use `ref` parameter instead (e.g. `ref="eX"`).
- Or: the snapshot is stale — call `browser_snapshot()` to refresh.

## "Ref eXX not found in the current page snapshot"

- The ref is stale (page changed since last snapshot).
- Call `browser_snapshot()` to get fresh refs.

## "Element is not an <input>, <textarea> or [contenteditable] element"

- You called `browser_type` on a non-editable element (e.g. `<div>`, `<ul>`, `<li>`).
- `browser_type` only works on `<input>`, `<textarea>`, or `[contenteditable]` elements.
- For custom dropdowns (`<ul role="listbox">`): use `browser_click` on the `<li role="option">` you want.
- For native `<select>`: use `browser_select_option`.
