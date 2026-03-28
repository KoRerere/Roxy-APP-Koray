# Example: Fill and Submit a Form

User: "Fill out the login form with username 'test' and password 'pass123'"

Decision Path (adapt ref/mcpId based on snapshot mode):
```
1. browser_snapshot()  # find form field identifiers
2. browser_type(element=<username-identifier>, text="test")
3. browser_snapshot()  # optional re-check
4. browser_type(element=<password-identifier>, text="pass123")
5. browser_click(element=<submit-identifier>)
6. browser_wait_for(time=2)
7. browser_snapshot()  # verify result
```

See `guides/snapshot-modes.md` for ref vs mcpId usage.
