# Example: Handle Dynamic Content

User: "Click the 'Load More' button and wait for new items"

Decision Path (adapt ref/mcpId based on snapshot mode):
```
1. browser_snapshot()  # find "Load More" button identifier
2. browser_click(element=<load-more-identifier>)
3. browser_wait_for(text="New Item")  # or use time=2
4. browser_snapshot()  # verify new items loaded
```

See `guides/snapshot-modes.md` for ref vs mcpId usage.
