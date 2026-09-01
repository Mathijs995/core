# Browser automation skills

`slack-browser`, `outlook-browser`, `whatsapp-browser`, `trello-browser`, and
`github-browser` all start from the same premise: drive a real Chrome window through
the Playwright MCP instead of standing up an integration. No app registrations, no
OAuth clients, no tokens to store or rotate — the browser is already logged in, and
the persistent Playwright profile keeps it that way between sessions.

What they do once they are in that window differs. The three messaging skills read
the DOM, because the DOM is all their apps expose. `trello-browser` does not: Trello
serves a REST API that accepts the browser's own session cookie, so the skill reaches
it with `fetch` from the board page and skips the DOM almost entirely.

`github-browser` is the odd one out, and worth explaining because its reason for
existing is not convenience. GitHub has an excellent CLI, and `gh-create-pr` should be
used wherever it works. But `gh` on this machine resolves to a BCG **Enterprise Managed
User**, and GitHub walls EMU accounts off from non-enterprise content by design:

```text
Unauthorized: As an Enterprise Managed User, you cannot access this content
```

No scope or token fixes that, and `GITHUB_TOKEN` in the environment makes
`gh auth switch` a no-op besides. Git itself is unaffected — the remote authenticates
over SSH as the personal account — so the working pattern is to push with `git` and
drive only the pull request through the browser.

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

The messaging skills are also read-limited on purpose: they never delete, archive,
react to, or forward anything.

`trello-browser` has to write — a task board nobody can update is not much use — so
it draws the line one step further in. Creating cards, moving them between lists,
commenting, setting due dates and labels, and ticking checklist items all happen on
request. Archiving and deleting do not, unless you ask for them in that same turn.
The reason is asymmetry of damage: `DELETE /1/cards/<id>` is permanent, with no
archive, no trash, and no undo, so the skill steers toward archiving and treats
deletion as something you must mean.

`github-browser` splits the same way. Opening a pull request is additive and happens
on request; merging is not, and needs to be asked for. It also refuses to merge past
failing checks, and verifies the result against `git log origin/main` rather than
trusting the page — a merge that appears to have worked in the UI is not evidence
that it landed.

## Why scraping, not screenshots

The three messaging applications render virtualized lists — only the messages
currently on screen exist in the DOM. Reading them by screenshot silently drops
content, and scroll-and-capture produces duplicated or missing rows. Each skill
instead scrapes the DOM directly and scrolls in steps to load history, deduplicating
by each app's own stable message identifier.

Trello's board canvas is virtualized in exactly the same way — around twenty card
tiles exist no matter how many cards the board holds — which is the concrete reason
`trello-browser` reads through the API instead. One request returns every list and
every card with due dates, labels, and checklist counts, and there is no selector to
rot when Trello reshuffles its markup.

## Authentication

| App | Mechanism | First run |
| --- | --- | --- |
| Slack | Okta SSO via `bcg.enterprise.slack.com` | Usually silent from a cached Okta session |
| Outlook | Microsoft sign-in federated to Okta | Enter the work address; federation completes it |
| WhatsApp | QR device pairing | Scan the code once from the phone |
| Trello | Atlassian account federated to Okta | Enter the work address; SAML completes it |
| GitHub | Personal account password + 2FA | Log in once by hand; no SSO path exists |

After the first successful login the Playwright profile holds the session, so later
runs start already authenticated.

There are two profiles, and the split matters. `pw-bcg` (`~/pw-profiles/bcg`) holds the
work identity and is what Outlook, Slack, and Trello use. `pw-personal` holds the
personal GitHub account, which is why `github-browser` names a different server from
every other skill here. Two Playwright servers cannot share a profile directory, so
"Browser is already in use" usually means the wrong server was chosen rather than a
stale lock left behind.

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

The same applies to `trello-browser`'s endpoints, which were exercised against the
real board — including a create-move-comment-delete round trip — rather than copied
from documentation. That is how its sharpest edge surfaced: mutating requests carry
a CSRF token from the `dsc` cookie, and it must travel in the JSON body. Sent as a
query parameter it returns 403, which on a create-then-delete pair means the create
succeeds and the cleanup silently does not.

`github-browser` was written the same way, by opening and merging a real pull request.
Two findings came out of it that documentation would not have given. Two buttons on the
compare page read "Create pull request" — a dropdown toggle and the actual submit — so
matching on the label alone fails as an ambiguous locator. And merging is two steps
rather than one, where the second step carries a commit-author email that can default
to the wrong address. The skill also avoids GitHub's newer hashed class names
(`prc-Button-ButtonBase-9n-Xk`), which change between deploys, in favour of accessible
names and the handful of stable semantic classes.

Web apps change. When a selector or an endpoint stops matching, re-verify it in the
browser and update the skill rather than working around it.
