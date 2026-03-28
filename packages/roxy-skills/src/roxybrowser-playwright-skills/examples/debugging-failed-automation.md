# Example: Debugging Failed Automation

User: "The form submission isn't working"

Decision Path:
```
1. browser_console_messages()  # check JS errors
2. browser_network_requests()  # check failed API calls
3. browser_snapshot()  # verify page state
4. Adjust next action based on errors
```
