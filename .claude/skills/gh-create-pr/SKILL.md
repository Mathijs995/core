---
name: gh-create-pr
description: >-
  Use when creating a pull request with the gh CLI — "open a PR", "create a pull
  request", or after committing work that needs review. Uses the body-file
  workflow to avoid shell-escaping breakage, and links a Jira ticket when the
  branch name carries one and the Atlassian MCP is connected.
---

# Create a PR with `gh`

**Core principle:** never pass a multi-line PR body as a shell argument. Backticks,
quotes, and `$` in a body get mangled or executed. Always write the body to a temp
file and use `--body-file`.

## Prerequisites

- `gh auth status` shows an authenticated account **for the repo's host account**
  (check this — a machine can hold several logins, and the active one may not own
  the target repo).
- Changes committed on a non-protected branch. If on `main`/`master`/`dev`/etc., branch first:
  `git checkout -b <type>/<short-description>`.

## Workflow

### 1. Read the diff before writing anything

```bash
git log "$(git rev-parse --abbrev-ref origin/HEAD | sed 's|origin/||')"..HEAD --oneline
git diff "$(git rev-parse --abbrev-ref origin/HEAD | sed 's|origin/||')"...HEAD --stat
```

Write the summary from what the diff actually does, not from the branch name.

### 2. Link a Jira ticket (optional)

Only when the repo's workflow uses Jira **and** the Atlassian MCP is connected
(`claude mcp list`). Otherwise skip to step 3 — a PR without a ticket is fine.

Detect the key from the branch name (`<type>/<KEY>-<slug>`, or a bare `KEY` anywhere;
case-insensitive, e.g. `fix/ABC-12-timeout` → `ABC-12`). Then:

```text
mcp__atlassian__getAccessibleAtlassianResources()   → cloudId
mcp__atlassian__getJiraIssue(cloudId, key)          → summary for the title/body
```

Ask the user for the project key rather than guessing if you need to *create* a
ticket. Never hardcode a project key, cloud ID, or assignee into a command.

### 3. Title and body

**Title** — Conventional Commits, imperative, under 72 chars, no trailing period:

```text
<type>(<scope>): <description>
<type>(<scope>): <KEY> <description>     # when a ticket is linked
```

`type`: `feat | fix | refactor | docs | chore | test | perf`.
`scope`: the area most affected — use the repo's own conventions.

**Body** — lead with *why*:

```markdown
## Summary
<2-4 sentences on why this change is needed>

## Changes
- <one bullet per logical change; skip trivia>

## Test plan
- [ ] <what to actually verify>
```

Add a `## Jira` section with a ticket link only when one is linked.

### 4. Push and create

```bash
body_file="$(mktemp -t pr-body)".md
cat > "$body_file" <<'EOF'
<body from step 3>
EOF

git push -u origin HEAD
gh pr create --base "$(git rev-parse --abbrev-ref origin/HEAD | sed 's|origin/||')" \
             --title "<title>" --body-file "$body_file"
```

Use `--draft` when the work is not ready for review. Quote the heredoc delimiter
(`<<'EOF'`) so the body is written literally.

### 5. Verify

```bash
gh pr view --json url,baseRefName,isDraft,title
```

Report the URL back to the user. If a ticket was linked, comment the PR URL on it
via `mcp__atlassian__addCommentToJiraIssue` and transition it if the board expects
that.

## Error handling

| Problem | Fix |
| --- | --- |
| `gh` not authenticated | `gh auth login` (verify the *active* account owns the repo) |
| Wrong account active | `gh auth switch` |
| Branch not on remote | `git push -u origin HEAD` |
| PR already exists | `gh pr list --head "$(git branch --show-current)"` |
| Base branch guessed wrong | Pass `--base` explicitly |
| Body renders mangled | You interpolated it into a shell arg — use `--body-file` |
