# Example: Connect and Navigate

User: "Connect to my RoxyBrowser and go to example.com"

Decision Path:
```
1. roxy_browser_connect(endpoint="ws://127.0.0.1:PORT/devtools/browser/ID", browserCore="Chrome")
2. browser_navigate(url="https://example.com")
3. browser_wait_for(time=2)
4. browser_snapshot()
```

Firefox variant:

```text
1. roxy_browser_connect(endpoint="ws://127.0.0.1:PORT/session", browserCore="Firefox")
2. browser_navigate(url="https://example.com")
3. browser_wait_for(time=2)
4. browser_snapshot()
```
