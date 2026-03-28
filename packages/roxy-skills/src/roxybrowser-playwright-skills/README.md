# RoxyBrowser Playwright Skills

This skill provides guidance for web automation using RoxyBrowser Playwright MCP tools.

## Purpose

Helps Claude select the right Playwright tools for common web automation tasks like:
- Navigation and page interaction
- Form filling and submission
- Data extraction and scraping
- Screenshot capture
- Multi-tab workflows
- Debugging and troubleshooting

## Usage

This skill is automatically loaded when working with RoxyBrowser Playwright MCP. It provides:
- Quick decision matrix for tool selection
- Critical rules for safe automation
- Progressive disclosure into guides, examples, and references

## Integration

Works in conjunction with `roxybrowser-openapi-skills`:
1. Use OpenAPI MCP to create/open browser profiles
2. Get CDP endpoint from OpenAPI MCP
3. Use Playwright MCP (this skill) for automation
4. Use OpenAPI MCP to clean up browsers

## File Structure

```
roxybrowser-playwright-skills/
├── SKILL.md
├── README.md
├── guides/
│   ├── tool-selection.md
│   ├── waiting-and-timing.md
│   └── error-handling.md
├── examples/
│   ├── connect-and-navigate.md
│   ├── form-fill-submit.md
│   ├── scrape-data.md
│   ├── dynamic-content.md
│   ├── multi-tab-workflow.md
│   ├── file-upload.md
│   └── debugging-failed-automation.md
└── references/
    └── tool-catalog.md
```

## Documentation

- Start with `SKILL.md`
- Use `references/tool-catalog.md` for full tool details
- Use `guides/` for decision and troubleshooting guidance
- Use `examples/` for step-by-step workflows
