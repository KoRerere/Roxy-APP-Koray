# Tool Catalog (RoxyBrowser Playwright MCP)

This catalog groups tools by intent and notes when to use them. Use `browser_snapshot` first to obtain element identifiers for interactions.

## Read-Only vs Destructive
- Read-only tools observe state (snapshot, list, inspect, console, network).
- Destructive tools change state (navigate, click, type, drag, upload).
- Prefer read-only tools unless the user intends to change the page.

## Connection and Setup
- `browser_connect_roxy` - Connect to a RoxyBrowser CDP endpoint.

## Navigation
- `browser_navigate` - Go to a URL (state changing).
- `browser_navigate_back` - Go back in history (read-only).
- `browser_navigate_forward` - Go forward in history (read-only).

## Page Analysis
- `browser_snapshot` - Accessibility tree snapshot for element identifiers (preferred).
- `browser_take_screenshot` - Visual capture only; cannot drive actions.

## Element Interaction
- `browser_click` - Click a button/link; requires element reference.
- `browser_hover` - Trigger hover states; requires element reference.
- `browser_drag` - Drag and drop between elements; requires element references.
- `browser_select_option` - Select dropdown option(s); requires element reference.

**Element reference parameter:**
- ARIA mode: use `ref` (string, e.g. `"e48"`)
- Optimized mode: use `mcpId` (number, e.g. `42`)

## Text Input
- `browser_type` - Type into `<input>`, `<textarea>`, or `[contenteditable]` only. Do NOT use on `<div>`, `<ul>`, `<li>`, `<span>`. Supports `submit` and `slowly`.
- `browser_press_key` - Press special keys (Enter, Tab, Arrow keys).

**Element reference parameter:** same as Element Interaction above.

## JavaScript Execution
- `browser_evaluate` - Run JS for extraction or custom logic.

## Files and Dialogs
- `browser_file_upload` - Upload files via file input; requires absolute paths.
- `browser_handle_dialog` - Accept or dismiss alert/confirm/prompt dialogs.

## Waiting and Timing
- `browser_wait_for` - Wait for time or text to appear/disappear.

## Browser Control
- `browser_close` - Close the current page.
- `browser_resize` - Set viewport size.

## Tab Management
- `browser_tab_list` - List open tabs.
- `browser_tab_new` - Open a new tab, optionally with URL.
- `browser_tab_select` - Switch to a tab by index.
- `browser_tab_close` - Close the current or specified tab.

## Debugging
- `browser_console_messages` - Inspect console logs and errors.
- `browser_network_requests` - Inspect network activity and failures.
