---
name: whatsapp-browser
description: Use when reading WhatsApp chats, checking WhatsApp messages from someone, or drafting/sending WhatsApp replies via the browser — including "what did X send me on WhatsApp", "read my WhatsApp", "draft a WhatsApp reply", or any task touching web.whatsapp.com with Playwright.
---

# WhatsApp via Browser (Playwright MCP)

Read chats and draft replies in WhatsApp Web (`https://web.whatsapp.com`) using the
Playwright MCP tools.

**Core principles:**

1. **Real clicks only.** WhatsApp is React with synthetic events — `el.click()` inside
   `browser_evaluate` silently does nothing. Open chats with `browser_click` on
   `span[title="<chat name>"]`.
2. **Draft ≠ send.** Type into the composer with fill (never `submit: true`); the text
   stays as a per-chat draft. Send ONLY when the user explicitly says "send" in the
   current request — by clicking the send button, never by pressing Enter.

## Auth (one-time per profile)

`browser_navigate` to `https://web.whatsapp.com`. The persistent profile keeps the
pairing. If "Scan to log in" appears, ask the user to scan the QR in the Playwright
window (phone: WhatsApp → Settings → Linked devices → Link a device), then poll for
`[aria-label="Chat list"]`. QR codes rotate; the page updates them itself.

## Operations

### Find a chat

Scan the chat list instead of using search (the search box only materializes on
interaction):

```js
[...document.querySelector('[aria-label="Chat list"]').querySelectorAll('[role="gridcell"]')]
  .map(c => c.querySelector('span[title]')?.getAttribute('title'))
```

Names appear twice (nested gridcells) — dedupe. Rows also carry unread badges and a
last-message preview in `innerText`. Scroll `#pane-side` for chats beyond the loaded set.

### Open a chat

`browser_click` on `span[title="<exact chat name>"]` → verify `#main header` shows the
name before reading or typing.

### Read messages

Every text bubble in `#main` has `data-pre-plain-text` = `"[HH:MM, M/D/YYYY] Sender: "`
— sender and timestamp come free, no direction detection needed:

```js
[...document.querySelectorAll('#main [data-pre-plain-text]')]
  .map(m => ({ pre: m.getAttribute('data-pre-plain-text'), text: m.innerText }))
```

Scroll `#main`'s scrollable ancestor up for older history (virtualized like Slack).
Link previews are part of `innerText`; media without caption has no
`data-pre-plain-text` node — flag if the conversation seems to have gaps.

### Draft a reply

`browser_type` (no `submit`) into the composer:
`[contenteditable="true"][data-tab="10"]` (aria-label "Type a message to <name>").
The text persists as a draft in that chat (chat list shows "Draft"). The user sends
it from any of their devices.

### Send (explicit approval only)

Only when the user's current request explicitly says to send: after typing, click
the send button (`button[aria-label="Send"]`, appears once text is present).
Never react, delete, or forward.

## Verified selectors (Aug 2026)

| Thing | Selector |
| ------- | ---------- |
| Chat list | `[aria-label="Chat list"]` (role=grid) inside `#pane-side` |
| Chat row | `[role="gridcell"]` with `span[title]` = chat name (duplicated — dedupe) |
| Open chat header | `#main header` |
| Message bubble (text) | `#main [data-pre-plain-text]` — attr = `"[time, date] Sender: "` |
| Composer | `[contenteditable="true"][data-tab="10"]` |
| Send button | `button[aria-label="Send"]` (only after text entered) |

## Gotchas

- **Enter in the composer SENDS.** Fill text in one call; never `submit: true`,
  never press Enter with the composer focused. Newlines inside a fill are safe.
- **JS `.click()` does nothing** — always `browser_click` (real mouse events).
- **Contenteditables don't exist until a chat is open** — an empty probe result
  means "no chat open", not "selector broken".
- **This is a personal account** — be conservative: draft-only by default, and
  never touch chats other than the one the task names.
- **Logout/expiry** shows "Scan to log in" again — redo Auth.
- **"Browser is already in use ... mcp-chrome-*"** — stale Playwright Chrome holds
  the profile lock; verify it's Playwright's profile (`ps aux | grep
  ms-playwright-mcp`), then kill the parent PID.
