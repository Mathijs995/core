# Skills

Each skill lives in `.claude/skills/<name>/` as a `SKILL.md` plus any helper
scripts. Claude Code loads a skill when its `description` frontmatter matches what
you are asking for, so descriptions are written as triggering conditions rather
than summaries.

| Skill | Purpose |
| --- | --- |
| [`slack-browser`](browser-automation.md) | Read Slack, triage unreads, draft replies |
| [`outlook-browser`](browser-automation.md) | Read and triage Outlook mail, draft replies |
| [`whatsapp-browser`](browser-automation.md) | Read WhatsApp chats, draft replies |
| [`trello-browser`](browser-automation.md) | Read and update the Trello task board |
| [`gh-create-pr`](gh-create-pr.md) | Open pull requests with the `gh` CLI |

## Writing a new skill

1. Create `.claude/skills/<name>/SKILL.md` with `name` and `description`
   frontmatter. Write the description as *when to use this*, not *what it does* —
   a description that summarises the workflow invites Claude to follow the summary
   instead of reading the skill.
2. **Verify against the real thing before writing it down.** Every selector and
   step in the browser skills was confirmed against the live application. A skill
   written from memory encodes guesses that fail silently later.
3. Keep the body scannable: a quick-reference table of selectors or commands beats
   prose, and a "gotchas" section is usually the most valuable part.
4. Run `uv run core skills link` so the new skill is available at the user level.
