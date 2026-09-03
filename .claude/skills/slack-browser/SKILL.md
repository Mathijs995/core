---
name: slack-browser
description: Use when reading BCG Slack conversations, triaging unread Slack messages, or drafting/sending Slack replies via the browser — including "what did I miss on Slack", "read this Slack thread", "draft a reply to X", or any task touching app.slack.com with Playwright.
---

# Slack via Browser (Playwright MCP)

Read chats, triage unreads, and draft replies in BCG's Slack
(`https://app.slack.com/client/E77AKTKA6/...`) using the Playwright MCP tools.

**Core principles:**

1. **Never screenshot-read messages.** The message list is virtualized — only visible
   rows exist in the DOM. Scrape with `extract-messages.js` instead.
2. **Draft ≠ send.** Type drafts into the composer (Slack autosaves them). Send ONLY
   when the user explicitly says "send" in the current request — and only by clicking
   `[data-qa="texty_send_button"]`, never by pressing Enter.

## Auth (one-time per profile)

1. `browser_navigate` to `https://app.slack.com/client/E77AKTKA6`. The persistent
   Playwright profile usually keeps the session — if the page title becomes a
   conversation name, you're in.
2. If redirected to "Find your workspace": do NOT type `bcg` (that's an unrelated
   workspace, "Broken Chair Games"). Instead navigate to
   `https://bcg.enterprise.slack.com` → **Sign in with Okta**. Read the link's `href`
   from the snapshot and `browser_navigate` to that `/sso/saml/start?…` URL directly —
   clicking it is unreliable (see the `target` gotcha below).
3. Okta often completes silently from a cached session. If it shows a login form,
   ask the user to finish SSO + MFA in the Playwright window
   (email `dejong.mathijs@bcg.com`), then continue.
4. Slack cold-boots slowly (URL gains `force_cold_boot=1`, retries with
   `cdn_fallback=N`). Wait until `document.title` names a conversation; give it 30s+.
   On a degraded network this can loop for **10-15 minutes** through `cdn_fallback=1`,
   `=2`, and even a "For some reason, Slack couldn't load" page — that is still
   recoverable, keep waiting and re-navigating. Each retry clears service-worker caches,
   which can drop the session and bounce you back to step 2.
   Confirm it's the network, not Slack: `curl -o /dev/null -w '%{time_total}'
   https://a.slack-edge.com/`. Multi-second asset fetches explain the loop.

## Operations

### Open a conversation

- **Known ID** (C…/D…): `browser_navigate` to `https://app.slack.com/client/E77AKTKA6/<ID>` — fastest and immune to switcher mishaps.
- **By name:** `Meta+k` opens dialog `[role="dialog"][aria-label="Jump to…"]`. Fill
  `[data-qa="texty_input"][aria-label="Query"]` (a contenteditable DIV, not an `<input>`)
  in one go — slow typing can commit a wrong entry mid-keystroke. Options are
  `[role="option"]` reading "name, workspace" (enterprise grid has many same-named
  channels — pick the right workspace). Click the option.
- **Always verify** `document.title` names the intended conversation before acting.
- The conversation can change under you (user click, notification). Re-verify the title
  or a known paragraph immediately before any write.

### Read messages

Run `extract-messages.js` via `browser_evaluate` (paste file contents as `function`).
Edit `HOPS` at the top for history depth (each hop ≈ one viewport of older messages).
Returns messages sorted oldest-first with `ts`, `time`, `sender`, `text`, `replies`.
Use the `filename` argument for long histories. For a thread, set `SCOPE` to
`[data-qa="threads_flexpane"]` after opening it.

### Open a thread

Click the reply bar (`[data-qa="reply_bar_count"]`, e.g. "8 replies") →
thread pane appears as `[data-qa="threads_flexpane"]` with its own composer.

### Triage unreads

`Meta+Shift+a` → Unreads view (`.p-unreads_view`), grouped per conversation with
"N messages" headers. Read via extraction with `SCOPE = '.p-unreads_view'`.
**Esc marks the current group as read** — don't press it casually.

### Draft a reply

Target `[data-qa="message_input"] .ql-editor` (the thread pane has its own — close the
flexpane first if you mean the channel). Slack autosaves the draft; the user reviews and
sends in their own client.

**`browser_type` REPLACES the composer unless you pass `slowly: true`.** The default
compiles to `.fill()`, which wipes everything already there — including mention pills you
just built. Always `slowly: true` when appending.

Compose the text in a scratchpad file first, then push it into the composer. Editing
prose in the browser is slow and error-prone; the file is also your recovery copy.

Build a message in this order:

1. **Mentions** — `browser_type` `@handle` with `slowly: true`, then `browser_press_key`
   `Tab` to commit. Tab, never Enter (Enter sends). Verify a real pill exists:
   `e.querySelectorAll('ts-mention')` with a `data-id`; plain `@text` does not notify.
   **Only ever slow-type the `@handle` itself.** `slowly: true` sends one keystroke at a
   time, and a Slack re-render mid-sentence moves the caret to the end of the message —
   splitting your text, with the tail silently appended to the last paragraph
   (`"…and 5 more of th"` at the top, `"ose. All fixed…"` at the bottom). Everything that is
   not a mention goes through `insertText`, which lands atomically.
2. **Body** — one `browser_evaluate` doing `document.execCommand('insertText', false, text)`
   with `\n` for line breaks. Beats dozens of `Shift+Enter` calls and never risks Enter.
   Each `\n` becomes a `<p>`; `innerText` then reads back doubled (`\n\n`) — that is the
   representation, not a bug. Confirm real spacing with a screenshot.
3. **Bulleted list** — select the range (`Range` over first→last `<p>`, put it in
   `getSelection()`), then click `button[aria-label="Bulleted list"]`.
4. **Verify** — dump every block and read the text back in full:
   `[...e.querySelectorAll('p,li')].map(n => n.tagName + ': ' + n.innerText)`.
   Counts alone hide truncation — check each line actually ends where it should, then
   screenshot. If anything split, clear and rebuild rather than patching in place.

Editing an existing draft: locate the target `<p>` by its text, select its contents with a
`Range`, and `insertText` the replacement. If the paragraph is not found, **stop** — the
conversation may have switched under you; never type blind.

Deleting: `Meta+a` then `Backspace` destroys the whole draft — only on the user's say-so.
Programmatic equivalent: loop `document.execCommand('delete', false)` N times.

Text inserted at the end of a formatted line **inherits that formatting** (a sentence
appended after a code-styled line becomes code). Check the toolbar state
(`button[aria-label="Code"]`) and rebuild the message clean if formatting has leaked.

### Send (explicit approval only)

Only when the user's current request explicitly says to send: click
`[data-qa="texty_send_button"]`. Never send as part of "draft a reply".
Never react, edit, or delete messages.

## Verified selectors (Aug 2026)

| Thing | Selector |
| ------- | ---------- |
| Message row (dedupe key = ts) | `.c-message_list [data-item-key]` (key matches `/^\d+\.\d+$/`; other keys are date separators) |
| Message content | `[data-qa="message_container"]` |
| Sender (first msg of group only) | `[data-qa="message_sender_name"]` — continuation rows inherit previous sender |
| Timestamp | `a.c-timestamp` → `data-ts` (epoch) + `aria-label` (human) |
| Body text | `[data-qa="message-text"]` |
| Thread reply bar | `[data-qa="reply_bar_count"]` |
| Message pane scroller | `.c-message_list .c-scrollbar__hider` |
| Composer | `[data-qa="message_input"] .ql-editor` |
| Send button | `[data-qa="texty_send_button"]` |
| Thread pane | `[data-qa="threads_flexpane"]` (close via `[data-qa="close_flexpane"]`) |
| Unreads view | `.p-unreads_view` |
| Mention pill | `ts-mention` → `data-id` (user ID), `data-label` (@handle) |
| Quick switcher | dialog `[role="dialog"][aria-label="Jump to…"]`, input `[data-qa="texty_input"][aria-label="Query"]`, options `[role="option"]` |
| Formatting buttons | `button[aria-label="Bulleted list"]`, `"Ordered list"`, `"Code"`, `"Code block"` |

## Gotchas

- **Enter in the composer SENDS the message.** Never `submit: true`, never press
  Enter while the composer is focused. Multiline: `Shift+Enter`, or `insertText` with `\n`.
- **`browser_type` without `slowly: true` wipes the composer** — it compiles to `.fill()`.
  Use `slowly: true` to append; plain `browser_type` only to start from empty.
- **This MCP variant requires a `target` parameter.** `element` + `ref` alone fails with
  `Invalid input: expected string, received undefined → at target`, and `target` — not
  `ref` — is the locator actually used. Pass a real CSS selector; a vague one silently
  clicks the wrong node (`target: "main"` clicks the whole page body).
- **Extraction scrolls the message list up.** Before finding recent messages or reply
  bars afterwards, reset: `scroller.scrollTop = scroller.scrollHeight`.
- **`pw-bcg` is NOT the user's real Chrome profile** — it's a separate Playwright profile
  (`~/pw-profiles/bcg`) with its own cold cache and session, which is why Slack can be
  instant in the user's Chrome and still cold-boot here. Repointing it needs an MCP
  config change plus the user's Chrome fully closed (profile lock); don't do it silently.
- **Quick switcher can navigate unexpectedly** while typing slowly — fill the query
  in one go, then click an option; verify the title afterwards.
- **"Browser is already in use ... mcp-chrome-*"** — stale Playwright Chrome holds the
  profile lock. Verify it's Playwright's own profile (`ps aux | grep ms-playwright-mcp`),
  not the user's real Chrome, then kill the parent PID.
- **`filename` args are sandboxed** to the project root / `.playwright-mcp/`.
- **Session expiry** shows the workspace-signin redirect again — redo Auth step 2.
