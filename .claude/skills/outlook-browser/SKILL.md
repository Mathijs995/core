---
name: outlook-browser
description: Use when reading BCG Outlook email, triaging the inbox, or drafting/sending replies via the browser — including "check my email", "what's in my inbox", "read that email from X", "draft a reply", or any task touching outlook.office.com with Playwright.
---

# Outlook via Browser (Playwright MCP)

Read email, triage the inbox, and draft replies in BCG's Outlook Web
(`https://outlook.office.com/mail/`) using the Playwright MCP tools.

**Core principles:**

1. **Triage from the list, don't open.** Each inbox row's `aria-label` already holds
   sender, subject, date, and preview — harvest those (`extract-inbox.js`) instead of
   opening messages. Opening a message marks it read.
2. **Draft ≠ send.** Compose replies and leave them (Outlook autosaves to Drafts).
   Send ONLY when the user explicitly says "send" in the current request — and only
   by clicking the button `aria-label="Send"`. Never press Ctrl+Enter (it sends).

## Auth (one-time per profile)

1. `browser_navigate` to `https://outlook.office.com/mail/`. Persistent profile may
   keep the session — you're in when the title reads "Mail - De Jong, Mathijs".
2. If the Microsoft "Sign in" form appears: fill `dejong.mathijs@bcg.com` + Enter.
   The Okta federation usually completes silently from a cached session.
3. If Okta shows a login/MFA form instead, ask the user to finish it in the
   Playwright window, then continue.

## Operations

### Triage inbox / any folder

Run `extract-inbox.js` via `browser_evaluate` — returns each row's `aria-label`
(sender, subject, date, preview), deduped, scrolling to load more (`HOPS` at top).
Folders by direct URL: `/mail/inbox`, `/mail/drafts`, `/mail/sentitems`,
`/mail/archive`; other folders via the folder pane (`[data-folder-name]`).

### Open a message

Click its `[data-convid]` row (this marks it read). The URL becomes a deep link
(`/mail/inbox/id/…`) you can save and revisit. Read from the pane
`[data-app-section="ConversationContainer"]`:

- Subject: `[data-app-section="ConversationSubjectContainer"]`
- Bodies: `[aria-label="Message body"]` **without** `contenteditable` — one node per
  message in the conversation, newest first. Use `.innerText`.

### Search

Fill `#topSearchInput`, press Enter. Results render as the same `[data-convid]`
rows — triage/open as above.

### Draft a reply

1. In the conversation pane, click the button `aria-label="Reply"` (use
   `"Reply all"` / `"Forward"` only when the user asks for them specifically).
2. Type with `browser_type` into `[contenteditable="true"][aria-label="Message body"]`
   — the `contenteditable` attribute is what distinguishes the compose editor from
   read-mode bodies.
3. Leave it: Outlook autosaves to Drafts for the user to review/send.
   To abandon a draft, click the button `aria-label="Discard"` (confirm if prompted).

### Draft a new email

Click button `aria-label="New mail"` → fill the To field (`aria-label="To"`) and
press Enter to resolve the address chip (verify: the pane announces "<address>
added"; external recipients also trigger an "outside your organization" banner) →
fill `input[aria-label="Subject"]` → then the body editor as above. Wait for the
"Draft saved at …" indicator before reporting the draft as done.

### Send (explicit approval only)

Only when the user's current request explicitly says to send: click the button
`aria-label="Send"`. Never send as part of "draft a reply". Never delete, archive,
or move messages.

## Verified selectors (Aug 2026)

| Thing | Selector |
| ------- | ---------- |
| List row (sender/subject/date/preview in aria-label) | `[data-convid][role="option"]` |
| Conversation pane | `[data-app-section="ConversationContainer"]` |
| Subject | `[data-app-section="ConversationSubjectContainer"]` |
| Read body (per message) | `[aria-label="Message body"]:not([contenteditable="true"])` |
| Compose editor | `[contenteditable="true"][aria-label="Message body"]` |
| Reply / Reply all / Forward / Send / Discard / New mail | `button[aria-label="…"]` (exact labels) |
| To recipients | `[aria-label="To"]` — type address, Enter resolves the chip |
| Subject | `input[aria-label="Subject"]` (placeholder "Add a subject" is NOT the aria-label) |
| Search | `#topSearchInput` |
| Folder pane entries | `[data-folder-name]` |

## Gotchas

- **Ctrl+Enter sends the message.** Never use it; plain Enter in the body is safe
  (newline).
- **Opening a message marks it read** — triage from row aria-labels when the user
  only wants an overview.
- **The list is virtualized** — only ~a screenful of `[data-convid]` rows exist;
  scroll the listbox's scrollable ancestor to load more (extract-inbox.js does this).
- **Multiple "Message body" nodes** — a conversation renders one per message; the
  compose editor also uses that label. Filter on `contenteditable`.
- **Session expiry** bounces to login.microsoftonline.com — redo Auth step 2.
- **"Browser is already in use ... mcp-chrome-*"** — stale Playwright Chrome holds
  the profile lock; verify it's Playwright's profile (`ps aux | grep
  ms-playwright-mcp`), then kill the parent PID.
