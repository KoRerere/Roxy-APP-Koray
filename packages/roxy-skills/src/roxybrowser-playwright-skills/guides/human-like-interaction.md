# Human-Like Interaction

Operate the page the way a real user would **by default**. The goal is to look human, not just to reach the result. When two paths lead to the same outcome, prefer the one that mirrors what a person sitting in front of the browser would do.

This is a preference, not a hard rule. If the human-like path doesn't actually work (click does nothing, no navigation happens, the control is unreachable), fall back to the mechanical path. "Prefer human-like, then mechanical when needed" — that's the whole principle.

## Core Principle

A human reads the page, moves the pointer, clicks things, and lets the browser react. So by default, click the link and let the browser transition, rather than extracting the URL and navigating to it directly. But if clicking doesn't cause a navigation (some links are JS-driven, broken, or no-op), it's perfectly fine to read the `href` and navigate to it yourself.

## Navigation: Prefer Clicking, Fall Back to Direct Navigation

When the page already offers a way to get somewhere, try it first.

- **Prefer** clicking an `<a>`, button, or nav item to move between pages, and let the browser perform the transition (including client-side routing, redirects, referrers).
- **Fall back** to reading the `href` and calling `browser_navigate` when:
  - clicking the link doesn't actually navigate (no transition occurs after the click + wait), or
  - the element is off-screen / disabled / in an unreachable iframe / shadow DOM, or
  - you need to go to a URL the user gave you directly (initial entry, or they pasted a link).

Why default to clicking: real users follow links, and clicking preserves referrers, analytics, lazy-loaded state, and SPA route transitions. Direct navigation skips those, which can break the page or look like a bot. But the keyword is "default" — if the click doesn't produce a navigation, don't keep retrying it blindly; take the URL and go.

```text
# Default (human-like) — try this first
1. browser_snapshot()
2. browser_click(element=<the link ref>)        # let the page navigate
3. browser_wait_for(text="...")                   # did the page actually change?
4. browser_snapshot()
#   ↓ if the click didn't navigate (URL/content unchanged)
# Fall back (mechanical) — read the href and go
5. browser_evaluate("document.querySelector('a.next')?.href")
6. browser_navigate(url=<extracted href>)
```

## Prefer Native Controls, Fall Back to JS

Default to the control the page exposes, but use JS when the control doesn't behave:

- **Prefer** submitting a form by clicking the submit button (or pressing Enter with `submit`); **fall back** to `form.submit()` via `browser_evaluate` if the button has no effect or isn't reachable.
- **Prefer** toggling a checkbox/radio/switch by clicking it; **fall back** to setting the property if the click doesn't register.
- **Prefer** opening a dropdown by clicking, then clicking the option; **fall back** to setting the `<select>` value if the dropdown is custom and unclickable.
- **Prefer** closing a modal by clicking "X" / "Cancel" or pressing Escape; **fall back** to hiding the node if there's no close affordance.

`browser_evaluate` is primarily an extraction tool, but it's also the legitimate fallback for changing state when the UI control doesn't cooperate.

## Drive the UI Instead of the URL/API (By Default)

When a feature lives behind a UI flow, walk the flow first:

- Searching: type into the search box and submit, instead of guessing the `?q=` query URL.
- Filtering/sorting: click the filter chips or sort control, instead of editing query params.
- Pagination: click "Next"/page numbers, instead of incrementing `?page=N`.
- Tabs/accordions: click the tab header to reveal content, instead of scraping hidden DOM.
- Login/auth: fill the form and click submit, instead of injecting cookies or calling the token endpoint directly.

Fall back to URL/API manipulation when the UI path is genuinely impractical (e.g. paginating 50 times by clicking "Next" — at that point constructing `?page=N` is reasonable) or blocked, and say so.

## Pacing and Variation

Real users aren't perfectly rhythmic. Add small, varied pauses between steps:

- After navigation or a click, prefer `browser_wait_for(text=...)` over a fixed timer — a short `time` buffer (1–3s) between discrete user actions is also fine and looks human.
- Vary the wait slightly between repeated iterations rather than hammering in a tight loop.
- Don't snapshot-and-act in the same breath every time — a brief pause before reading the page mimics the time a person takes to look.

## When Mechanical Is Fine

Direct methods are reasonable, not forbidden, when:
- The human-like click/action didn't produce the expected effect (verify first, then fall back).
- The element is unreachable (cross-origin iframe, shadow DOM with no exposed controls).
- You need to read data the UI doesn't surface (e.g. collecting all `href`s before deciding which to visit).
- The user explicitly asked for speed, or bulk operations at scale where clicking one-by-one is impractical.

The point is to **try human-like first**, not to insist on it when it isn't working.

## Decision Checklist

Before each action, ask:
1. Is there a visible control a human would use here? → Try it first.
2. Did that control actually produce the expected effect? → If yes, continue. If no, fall back to the mechanical path.
3. Am I about to extract a URL/value to feed back into navigation/setting? → That's fine as a fallback, but try clicking the control first.
4. Am I using `browser_evaluate` to change state? → Acceptable when no UI control works.
5. Have I waited for the page to settle after the last action? → Wait, then re-snapshot.
