---
name: trello-browser
description: Use when reading or updating the Trello task board via the browser — including "what's on my board", "what am I doing today", "add a card for X", "move X to Done", "what's overdue", or any task touching trello.com with Playwright.
---

# Trello via Browser (Playwright MCP)

Read and update the **Mathijs | Tasks** board (`https://trello.com/b/MfTZJ6DT`)
using the Playwright MCP tools.

**Use the `pw-bcg` server — `mcp__pw-bcg__browser_*`.** The board belongs to the
Atlassian account behind `dejong.mathijs@bcg.com`, and that session lives in the
`~/pw-profiles/bcg` profile. The personal Google account is a different profile
(`pw-personal`) and is **not** a member of this board.

**Core principles:**

1. **Use the API, not the DOM.** Trello's REST API at `trello.com/1/...` accepts the
   browser's session cookie, so `browser_evaluate` + `fetch` reads and writes the real
   board. The board canvas only renders ~20 cards regardless of how many exist — DOM
   scraping silently loses the rest.
2. **Additive writes are free; destructive ones are not.** Creating cards, moving them,
   commenting, setting due dates and labels, and ticking checklist items are all fine on
   request. **Archiving, deleting, and bulk edits happen only when the user asks for them
   explicitly in the current turn.** Card deletion is irreversible — prefer archiving.

## Auth (one-time per profile)

1. `browser_navigate` to `https://trello.com/b/MfTZJ6DT`. The persistent profile
   usually keeps the session — you're in when the title reads "Mathijs | Tasks | Trello".
2. If you land on a marketing page or a login form, go to `https://trello.com/login`,
   fill `#username-uid1` with `dejong.mathijs@bcg.com`, click `#login-submit`.
3. Atlassian federates to `logon.bcg.com` (Okta), which normally completes **silently**
   from a cached session and lands on `/u/mathijs995/boards`. Allow ~10s for the SAML
   hops. If Okta shows a login/MFA form, ask the user to finish it in the Playwright
   window, then continue.

## The `api()` helper

Every operation below is a call to this. Paste it at the top of the
`browser_evaluate` function — it handles the CSRF token that mutations require.

```js
const dsc = decodeURIComponent(document.cookie.split('; ').find((c) => c.startsWith('dsc=')).slice(4));
const api = async (method, path, body) => {
  const opts = { method, credentials: 'include' };
  if (method !== 'GET') {
    opts.headers = { 'Content-Type': 'application/json' };
    opts.body = JSON.stringify({ ...(body || {}), dsc }); // dsc MUST be in the body
  }
  const r = await fetch(`https://trello.com/1${path}`, opts);
  if (!r.ok) throw new Error(`${method} ${path} → ${r.status} ${(await r.text()).slice(0, 150)}`);
  return r.json();
};
```

Any `trello.com` page satisfies the same-origin requirement — you do not have to be on
the board itself. Batch several `api()` calls into one `browser_evaluate` rather than
making a round trip per card.

## Operations

### Read the board

Run `board.js` via `browser_evaluate` (paste file contents as `function`). Returns every
open list with its cards — name, short-link id, URL, due date, `overdue` flag, labels,
and badge counts for checklists/comments/attachments. Set `INCLUDE_DONE = true` at the
top to include `Done ✅`, which is excluded by default because it grows without bound.

### Read one card in full

```js
await api('GET', '/cards/Zqq5TUqs?fields=name,desc,due,dueComplete,idList,shortUrl,labels,closed' +
  '&checklists=all&checklist_fields=name&actions=commentCard&actions_limit=20');
```

A card's **short link** (`Zqq5TUqs`, the code in `trello.com/c/<code>`) works anywhere an
id is expected — no need to resolve it to the long id first.

### Find a card

```js
await api('GET', '/search?query=MDA&idBoards=625bed6222de9077875cd9ec' +
  '&modelTypes=cards&card_fields=name,shortLink,idList&cards_limit=10');
```

Card names on this board are `Prefix | Detail` (`Admin | …`, `Slide | …`, `IT | …`).
Match on the detail, not the prefix — several cards share a prefix, and a few share a
name outright (three cards are called "Weekend tasks"). When a query is ambiguous,
list the candidates with their lists and URLs and ask which one, rather than guessing.

### Create a card

```js
await api('POST', '/cards', {
  idList: '625bfbcbab131601b5ee8e56',      // Today 🎯 — see List IDs below
  name: 'Admin | Chase the invoice',
  desc: 'optional markdown body',
  due: '2026-09-05T17:00:00.000Z',          // optional, ISO 8601 UTC
  idLabels: ['6a064f9f340b8c130c6210d3'],   // optional
  pos: 'top',                               // 'top' | 'bottom' | number
});
```

Match the board's naming convention when creating cards, and apply a label — every
existing card carries one.

### Move, rename, reschedule

```js
await api('PUT', '/cards/Zqq5TUqs', { idList: '625bed6222de9077875cd9f1', pos: 'top' });
await api('PUT', '/cards/Zqq5TUqs', { name: 'New name', desc: 'New body' });
await api('PUT', '/cards/Zqq5TUqs', { due: null });            // clear the due date
await api('PUT', '/cards/Zqq5TUqs', { dueComplete: true });    // tick the due-date checkbox
await api('PUT', '/cards/Zqq5TUqs', { idLabels: ['<id>', '<id>'] }); // replaces all labels
```

"Mark X done" means **move the card to `Done ✅`**, not archive it and not
`dueComplete` — those are different states the user reads differently.

### Comment

```js
await api('POST', '/cards/Zqq5TUqs/actions/comments', { text: 'Sent the follow-up.' });
```

### Checklists

```js
const cl = await api('POST', '/cards/Zqq5TUqs/checklists', { name: 'Steps' });
const item = await api('POST', `/checklists/${cl.id}/checkItems`, { name: 'first step' });
await api('PUT', `/cards/Zqq5TUqs/checkItem/${item.id}`, { state: 'complete' });
```

Note the asymmetry: check items are **created** under `/checklists/<id>` but **updated**
under `/cards/<id>/checkItem/<id>`.

### Archive / delete (explicit approval only)

```js
await api('PUT', '/cards/Zqq5TUqs', { closed: true });   // archive — reversible
await api('DELETE', '/cards/Zqq5TUqs');                  // permanent, no undo
```

Only when the user's current request explicitly says to archive or delete. Prefer
archiving; reach for `DELETE` only when the user says "delete" and means it. Never
archive a list or the board.

## Board reference (verified Sep 2026)

Board id `625bed6222de9077875cd9ec`, short link `MfTZJ6DT`. Solo board — the only
member is `mathijs995`, so member assignment never comes up.

| List | idList |
| ------ | -------- |
| To Do 📋 | `625bed6222de9077875cd9ee` |
| This week 📆 | `68a3746f17bacfecf67ae1f3` |
| Today 🎯 | `625bfbcbab131601b5ee8e56` |
| Doing ☕️ | `625bf8ce95e93284fa97913d` |
| Pending & blocked 💤 | `625bed6222de9077875cd9ef` |
| Done ✅ | `625bed6222de9077875cd9f1` |
| Backlog 🤩 | `625bed6222de9077875cd9ed` |

| Label | idLabel | Colour |
| ------- | --------- | -------- |
| BCG \| CommAI | `6a064fd6a1dd8859593e80b4` | green |
| BCG \| Project | `6a064fcfbb97f164b57d0593` | green_dark |
| BCG \| Other | `6a064fdf74f9e620a00873ad` | green_light |
| Personal | `6a064fa5281e5c443f618e26` | purple_light |
| Urgent | `6a064f9f340b8c130c6210d3` | red |

These ids are a cache to save a round trip. If one 404s, refresh with
`api('GET', '/boards/MfTZJ6DT/lists?fields=name')` or `/labels?fields=name,color`.

## A different board

Everything above is board-agnostic apart from the ids. Given another board URL, take the
short link from `trello.com/b/<shortLink>`, set `BOARD` in `board.js`, and re-read that
board's lists and labels with the two calls above. An **invite** URL
(`/invite/b/<id>/<token>/<slug>`) redirects to the canonical `/b/<shortLink>` — follow
the redirect and use the short link.

## DOM fallback (verified Sep 2026)

Only for showing the user something on screen, or for the rare thing the API can't do.
Reads should still go through the API.

| Thing | Selector |
| ------- | ---------- |
| Board canvas | `[data-testid="board-canvas"]` |
| List column | `[data-testid="list"]` |
| List name | `[data-testid="list-name"]` |
| Card tile | `[data-testid="trello-card"]` |
| Card link (`href="/c/<shortLink>/<slug>"`) | `a[data-testid="card-name"]` |
| Add a card | `[data-testid="list-add-card-button"]` |
| Open a card detail | navigate to `https://trello.com/c/<shortLink>` |

## Gotchas

- **`dsc` must go in the JSON body** for POST/PUT/DELETE. Passing it as a query
  parameter returns 403 — with a create-then-delete pair, that leaves the card behind.
- **The board canvas is virtualized** — ~20 `[data-testid="trello-card"]` nodes exist no
  matter how many cards the board holds. Never count or enumerate cards from the DOM.
- **`DELETE /1/cards/<id>` is permanent.** No archive, no undo, no trash.
- **`idLabels` on PUT replaces the whole set** — read the current labels first and send
  the union if you mean to add one.
- **Duplicate card names are real** on this board; disambiguate by list and short link.
- **Session expiry** bounces to `id.atlassian.com/login` — redo Auth step 2.
- **"Browser is already in use ... mcp-chrome-*"** — stale Playwright Chrome holds the
  profile lock; verify it's Playwright's profile (`ps aux | grep ms-playwright-mcp`),
  then kill the parent PID.
