---
name: github-browser
description: Use when acting on a personal (Mathijs995) GitHub repo where the `gh` CLI is blocked — opening or merging a PR, checking CI, reviewing PR status — or whenever `gh` reports "Enterprise Managed User, you cannot access this content" or a 403/READ-only permission on a personal repo.
---

# GitHub via Browser (Playwright MCP)

Open, inspect, and merge pull requests on **personal** (`Mathijs995`) repos by driving
github.com, for the cases where the `gh` CLI cannot.

**Use the `pw-personal` server — `mcp__pw-personal__browser_*`.** That profile holds the
`Mathijs995` session. `pw-bcg` is the BCG profile and is *not* signed into personal
GitHub.

## When to use this instead of `gh`

Prefer the `gh-create-pr` skill. It is faster and scriptable. It only fails in one
specific, permanent way, and this skill exists for that case.

`gh` on this machine resolves to `DeJong-Mathijs_bcgprod`, a GitHub **Enterprise Managed
User**. EMU accounts are architecturally walled off from non-enterprise content, so that
identity can never act on a personal repo regardless of token scopes:

```text
gh: Unauthorized: As an Enterprise Managed User, you cannot access this content
gh repo view Mathijs995/<repo> --json viewerPermission  → {"viewerPermission":"READ"}
```

Two things make this hard to escape rather than merely inconvenient:

- `GITHUB_TOKEN` is exported in the shell, and `gh` prefers it over the keyring, so
  `gh auth switch` has no effect while it is set.
- The stored `Mathijs995` token is expired, so even `env -u GITHUB_TOKEN` still lands on
  the EMU account.

**Git itself is fine.** The remote is `git@github.com-personal:Mathijs995/<repo>.git` and
authenticates over SSH as the personal user, so `git push` works normally. Only the
`gh` API layer is blocked. **Push with git, then use this skill for the PR.**

Decision rule: BCG-owned repo → `gh-create-pr`. Personal `Mathijs995` repo → this skill.

## Auth check (do this first)

```js
document.querySelector('meta[name="user-login"]')?.content; // → "Mathijs995"
```

`null` means signed out — the page renders normally either way, so **always check this
before acting**, or you will fill in a form that silently cannot submit. If signed out,
ask the user to log in via the Playwright window; GitHub login needs a password and 2FA
that only they can complete.

## Operations

### Open a pull request

1. Push the branch first with plain `git push -u origin HEAD` (SSH works).
2. Navigate to the compare page — it pre-fills the form, so there is no need to click
   through the branch pickers:

   ```text
   https://github.com/<owner>/<repo>/compare/<base>...<head>?expand=1
   ```

3. Fill title and body. **Use the fill tool, not `browser_evaluate`** — PR bodies are
   full of backticks, apostrophes, and `$`, and injecting them through a JS string
   literal is where this goes wrong.

   | Field | Selector |
   | ------- | ---------- |
   | Title | `input[name="pull_request[title]"]` |
   | Body | `#pull_request_body` |

   The title pre-fills from the branch name (`feat/foo-bar` → "Feat/foo bar"); overwrite
   it with a Conventional Commits title. Leave the `input[name^="required_field_"]`
   honeypot untouched.

4. Verify before submitting — read back `.value` for both fields and confirm
   `#draft_on` is unchecked unless a draft is wanted.
5. Click `button[type="submit"].hx_create-pr-button`. The page navigates to
   `/<owner>/<repo>/pull/<n>` on success.

### Check status before merging

Run `pr-status.js` via `browser_evaluate` (paste file contents as `function`) on the PR
page. Returns the merge state, whether checks passed, and each check with its outcome.

Wait for CI rather than merging straight after creating — checks take ~60s here and the
merge box reports "Some checks haven't completed yet" until they land.

### Merge (explicit approval only)

Only when the user's current request says to merge.

1. Confirm `pr-status.js` reports `allPassed` and no conflict.
2. Click the merge button — `button:has-text("Merge pull request")` matches **two**
   elements, so target the wide one inside the merge box (`button.flex-1`) rather than
   the split-button dropdown toggle beside it.
3. A confirmation panel appears with a **commit-author email** combobox. Check it: it
   may default to `dejong.mathijs@bcg.com`, which is right only if the repo's existing
   history uses that address. Verify with `git log -1 --format=%ae`.
4. Click `Confirm merge` (locate by role and name — its classes are hashed).
5. Verify: the page shows "Pull request successfully merged and closed". Confirm
   independently with `git fetch origin && git log origin/main --oneline -3` rather than
   trusting the page alone.

Never force-merge past failing checks, never dismiss a review, and never delete a branch
unless asked.

### List pull requests

Navigate to `/<owner>/<repo>/pulls?q=is%3Apr` (add `is%3Aopen` to filter). Rows are
`.js-issue-row`; each row's `innerText` carries title, number, author, and state, and
`a[href*="/pull/"]` gives the link.

## Verified selectors (Sep 2026)

| Thing | Selector |
| ------- | ---------- |
| Signed-in user | `meta[name="user-login"]` → `content` |
| PR title field | `input[name="pull_request[title]"]` |
| PR body field | `#pull_request_body` |
| Spam honeypot (leave empty) | `input[name^="required_field_"]` |
| Draft radio | `#draft_on` / `#draft_off` |
| Create PR submit | `button[type="submit"].hx_create-pr-button` |
| Merge button | `button.flex-1:has-text("Merge pull request")` |
| Confirm merge | button with accessible name `Confirm merge` |
| Merge-box status rows | `.merge-status-item` |
| PR list row | `.js-issue-row` |

## Gotchas

- **Two buttons read "Create pull request"** on the compare page: a `js-details-target`
  dropdown toggle and the real `type="submit"`. Matching on text alone is a Playwright
  strict-mode violation that fails the call.
- **GitHub's newer PR UI uses hashed class names** (`prc-Button-ButtonBase-9n-Xk`,
  `MergeStatusButton-module__…`). Never anchor on those — they change per deploy. Use
  role + accessible name, or the stable semantic classes in the table above.
- **`browser_click` and `browser_fill_form` on these MCP servers take `target`** (a CSS
  selector or ref string), not the `element` + `ref` pair. Passing `ref` fails with
  `expected string, received undefined → at target`.
- **Merging is two clicks**, not one, and the second step can silently attribute the
  merge commit to the wrong email.
- **A signed-out github.com looks almost identical** for public repos — check
  `meta[name="user-login"]` rather than eyeballing the page.
- **Uninstalling a GitHub App is asynchronous.** The settings page says "A job has been
  queued" and still lists the app; reload after ~20s to confirm it actually went.
- **`gh auth switch` cannot help while `GITHUB_TOKEN` is exported** — see the section
  above. Do not burn turns retrying it.
