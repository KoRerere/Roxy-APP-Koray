# Example: Connect and Navigate

User: "Connect to my RoxyBrowser and go to example.com"

Decision Path:
```
1. browser_connect_roxy(cdpEndpoint="ws://127.0.0.1:PORT/devtools/browser/ID")
2. browser_navigate(url="https://example.com")
3. browser_wait_for(time=2)
4. browser_snapshot()
```
