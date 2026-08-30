# gh-create-pr

Opens a pull request with the `gh` CLI.

## The core problem it solves

A PR body is multi-line markdown containing backticks, quotes, and often `$`.
Passing that as a shell argument gets it mangled — or executed. The skill always
writes the body to a temp file and uses `--body-file`, with a quoted heredoc
delimiter so the content is written literally.

## Workflow

1. **Read the diff first.** The summary is written from what changed, not from the
   branch name.
2. **Link a Jira ticket** when the repo uses one and the Atlassian MCP is
   connected — detected from the branch name. Optional; a PR without a ticket is
   fine.
3. **Compose** a Conventional Commits title (under 72 characters, imperative) and a
   body that leads with *why*, followed by changes and a test plan.
4. **Push and create**, then verify with `gh pr view` and report the URL.

## Watch the active account

`gh` can hold several logins at once, and the active one is not necessarily the one
that owns the target repo. Check `gh auth status` before pushing; switch with
`gh auth switch` if it names the wrong account.

## Nothing hardcoded

The skill carries no project key, Atlassian cloud ID, or assignee. Those belong to
one specific repo's workflow, and a skill that hardcodes them fails confusingly
everywhere else. Where a value is genuinely needed, the skill asks rather than
guesses.
