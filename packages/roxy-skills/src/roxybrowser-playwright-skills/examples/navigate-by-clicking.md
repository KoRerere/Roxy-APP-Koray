# Example: Navigate by Clicking Links (Human-Like)

User: "Go to the site, then open the 'Pricing' page and read the plans."

Decision Path — try clicking first; fall back to direct navigation only if the click doesn't navigate. Adapt ref/mcpId based on snapshot mode (see `guides/snapshot-modes.md`).

```text
1. roxy_browser_connect(endpoint="ws://...", browserCore="Chrome")
2. browser_navigate(url="https://example.com")     # initial entry
3. browser_wait_for(text="Home")                    # let page settle
4. browser_snapshot()                               # find the "Pricing" link
5. browser_click(element=<"Pricing" link ref>)      # prefer: let the browser navigate
6. browser_wait_for(text="Plans")                   # did the page actually change?
7. browser_snapshot()                               # read the plans
```

Fallback — only if step 5's click didn't cause a navigation (URL/content unchanged after waiting):

```text
6b. browser_evaluate("document.querySelector('a[href*=\"pricing\"]')?.href")
6c. browser_navigate(url=<extracted href>)          # mechanical fallback, fine when click failed
```

Notes:
- Clicking is the default because it preserves referrers, client-side routing, analytics, and lazy-loaded state. Direct navigation can break SPAs and look like a bot — but it's a legitimate fallback when the click doesn't work.
- If the link opens a new tab, follow with `browser_tab_list` + `browser_tab_select`.
- Same idea applies to pagination, tabs, breadcrumbs, and filters: try clicking the control first; construct the URL only if clicking is impractical (e.g. paginating dozens of times) or doesn't work.
