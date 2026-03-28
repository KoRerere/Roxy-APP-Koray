# Example: Multi-Tab Workflow

User: "Open product links in new tabs and compare prices"

Decision Path:
```
1. browser_snapshot()  # collect product URLs
2. For each URL:
   a. browser_tab_new(url="...")
   b. browser_wait_for(time=2)
   c. browser_evaluate(function="() => document.querySelector('.price')?.textContent")
3. browser_tab_list()  # confirm open tabs
4. Compare results and report
5. browser_tab_close()  # clean up
```
