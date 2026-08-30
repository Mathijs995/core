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
   `https://bcg.enterprise.slack.com` → click **Sign in with Okta**.
3. Okta often completes silently from a cached session. If it shows a login form,
   ask the user to finish SSO + MFA in the Playwright window
   (email `dejong.mathijs@bcg.com`), then continue.
4. Slack cold-boots slowly (URL gains `force_cold_boot=1`, retries with
   `cdn_fallback=N`). Wait until `document.title` names a conversation; give it 30s+.

## Operations

### Open a conversation

- **Known ID** (C…/D…): `browser_navigate` to `https://app.slack.com/client/E77AKTKA6/<ID>` — fastest and immune to switcher mishaps.
- **By name:** `Meta+k` → type into the combobox named "Query" (use fill, not slow
  typing — slow typing can commit a wrong entry mid-keystroke) → options read
  "name, workspace" (enterprise grid has many same-named channels — pick the right
  workspace) → click the option.
- **Always verify** `document.title` names the intended conversation before acting.

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

`browser_type` into `[data-qa="message_input"] .ql-editor` (thread pane has its own).
Slack autosaves it as a draft; the user can review/edit/send in their own client.
To rewrite a draft: `Meta+a` then `Backspace`, then type again.

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
| Thread pane | `[data-qa="threads_flexpane"]` |
| Unreads view | `.p-unreads_view` |

## Gotchas

- **Enter in the composer SENDS the message.** Never `submit: true`, never press
  Enter while the composer is focused. Multiline: `Shift+Enter`.
- **Quick switcher can navigate unexpectedly** while typing slowly — fill the query
  in one go, then click an option; verify the title afterwards.
- **"Browser is already in use ... mcp-chrome-*"** — stale Playwright Chrome holds the
  profile lock. Verify it's Playwright's own profile (`ps aux | grep ms-playwright-mcp`),
  not the user's real Chrome, then kill the parent PID.
- **`filename` args are sandboxed** to the project root / `.playwright-mcp/`.
- **Session expiry** shows the workspace-signin redirect again — redo Auth step 2.
