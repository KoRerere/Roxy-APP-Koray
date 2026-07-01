# Example: ARIA Mode — Search on Bing

User: "Search for 'antidetect browser' on Bing"

Snapshot mode: aria (default)

## Decision Path

```
1. roxy_browser_connect(endpoint="ws://...", browserCore="Chrome")
2. browser_navigate(url="https://www.bing.com")
3. browser_snapshot()
   → Snapshot shows: textbox "Search..." [ref=e48]
4. browser_type(ref="e48", text="antidetect browser", submit=true)
   → CORRECT: uses ref="e48" (string with "e" prefix)
   → WRONG: mcpId=48 (number without "e" prefix)
5. browser_snapshot()  # get fresh refs for search results
6. browser_click(ref="e120")  # click a search result
```

## Key Points
- `ref` is a STRING: "e48", "e120", "e5"
- Always include the "e" prefix
- Never extract the number and use it as mcpId
- Always re-snapshot after navigation to get fresh refs
- If you are automating Firefox, connect with a Firefox BiDi endpoint and `browserCore="Firefox"` first
