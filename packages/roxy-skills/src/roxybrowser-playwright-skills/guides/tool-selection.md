# Tool Selection Guide

Use this guide when the correct tool is not obvious or when several tools could work.

## High-Level Flow
1. Connect: `browser_connect_roxy`
2. Navigate (if needed): `browser_navigate`
3. Snapshot: `browser_snapshot`
4. Interact using element identifiers from snapshot
5. Wait and re-snapshot after any page change

## Snapshot vs Screenshot
- Use `browser_snapshot` for automation and element refs.
- Use `browser_take_screenshot` only when the user wants a visual artifact.

## Common Choices
- Click or submit: `browser_click`
- Enter text: `browser_type` (use `submit` if needed)
- Select from dropdown: `browser_select_option`
- Wait for content: `browser_wait_for` (prefer `text` or `textGone`)
- Extract data: `browser_evaluate` after a snapshot

## Dropdown & Listbox Handling
- Native `<select>`: use `browser_select_option(mcpId=N, values=["value"])`
- Custom dropdown (`<ul role="listbox">` with `<li role="option">`): use `browser_click` on the desired `<li>` option directly
- If the desired option is not visible in the snapshot, scroll or use `browser_press_key` to navigate the list
- NEVER use `browser_type` on non-editable elements (`<div>`, `<ul>`, `<li>`, `<span>`) — it will fail with `locator.fill` error

## Debugging
- UI not reacting: re-snapshot and re-check element identifiers.
- Errors or failures: `browser_console_messages` + `browser_network_requests`.

## Multi-Tab Workflows
- Use `browser_tab_new` for new tabs, `browser_tab_select` to switch, and `browser_tab_list` to verify indices.
