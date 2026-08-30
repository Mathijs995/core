# Browser automation skills

`slack-browser`, `outlook-browser`, and `whatsapp-browser` all work the same way:
they drive a real Chrome window through the Playwright MCP rather than calling an
API. No app registrations, no OAuth clients, no tokens to store or rotate — the
browser is already logged in, and the persistent Playwright profile keeps it that
way between sessions.

## The safety rule

!!! warning "Draft by default"
    These skills **draft; they do not send.** A reply is typed into the composer and
    left there. Sending happens only when you explicitly ask for it in the same
    request, and only by clicking the application's real send button.

That last detail matters more than it looks. In Slack and WhatsApp, pressing
<kbd>Enter</kbd> in the composer sends immediately; in Outlook it is
<kbd>Ctrl</kbd>+<kbd>Enter</kbd>. Every one of these skills forbids the keystroke
and requires a button click, so a stray newline in drafted text cannot fire a
half-written message at a colleague.

The skills are also read-limited on purpose: they never delete, archive, react to,
or forward anything.

## Why scraping, not screenshots

All three applications render virtualized lists — only the messages currently on
screen exist in the DOM. Reading them by screenshot silently drops content, and
scroll-and-capture produces duplicated or missing rows. Each skill instead scrapes
the DOM directly and scrolls in steps to load history, deduplicating by each app's
own stable message identifier.

## Authentication

| App | Mechanism | First run |
| --- | --- | --- |
| Slack | Okta SSO via `bcg.enterprise.slack.com` | Usually silent from a cached Okta session |
| Outlook | Microsoft sign-in federated to Okta | Enter the work address; federation completes it |
| WhatsApp | QR device pairing | Scan the code once from the phone |

After the first successful login the Playwright profile holds the session, so later
runs start already authenticated.

!!! note "Slack workspace gotcha"
    Typing `bcg` into Slack's "find your workspace" page lands on an unrelated
    workspace. The correct entry point is `bcg.enterprise.slack.com`. The skill
    records this, along with the habit of verifying the page title names the
    intended conversation before typing anything into it.

## Verified, not guessed

Each skill's selector table was confirmed against the live application at the time
of writing, including the parts that are easy to get wrong: WhatsApp ignores
JavaScript `.click()` because it listens for real mouse events, and Outlook's
subject field is `input[aria-label="Subject"]` even though the visible placeholder
reads "Add a subject".

Web apps change. When a selector stops matching, re-verify it in the browser and
update the table rather than working around it.
