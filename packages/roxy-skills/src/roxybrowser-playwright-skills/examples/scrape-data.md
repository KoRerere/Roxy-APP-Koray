# Example: Scrape Data from a Page

User: "Extract all product prices from this page"

Decision Path:
```
1. browser_snapshot()  # identify price elements
2. browser_evaluate(function="() => Array.from(document.querySelectorAll('.price')).map(el => el.textContent)")
```
