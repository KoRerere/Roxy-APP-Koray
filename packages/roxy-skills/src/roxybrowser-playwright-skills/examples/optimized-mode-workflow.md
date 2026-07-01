# Example: Optimized Mode — Fill a Login Form

User: "Log in to the website"

Snapshot mode: optimized

## Decision Path

```
1. roxy_browser_connect(endpoint="ws://...", browserCore="Chrome")
2. browser_navigate(url="https://example.com/login")
3. browser_snapshot()
   → Snapshot shows:
   <input mcpId="5" type="text" name="username" />
   <input mcpId="6" type="password" name="password" />
   <button mcpId="7" role="button">Login</button>
4. browser_type(mcpId=5, text="user@example.com")
5. browser_type(mcpId=6, text="password123")
6. browser_click(mcpId=7)
7. browser_snapshot()  # verify login success
```

## Key Points
- `mcpId` is a NUMBER: 5, 6, 7
- Use the exact number from the snapshot
- Never add "e" prefix or convert to string
- Always re-snapshot after interactions
