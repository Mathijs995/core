# core

[![CI](https://github.com/Mathijs995/core/actions/workflows/ci.yml/badge.svg)](https://github.com/Mathijs995/core/actions/workflows/ci.yml)
[![Docs](https://github.com/Mathijs995/core/actions/workflows/docs.yml/badge.svg)](https://mathijs995.github.io/core/)

Personal skills and automation toolkit — the source of truth for the
[Claude Code](https://claude.com/claude-code) skills I use every day, plus the
small CLI that installs them.

Documentation: <https://mathijs995.github.io/core/>

## Why this exists

Skills are just markdown and a few helper scripts, but they rot fast when they live
loose in `~/.claude/skills/`: no history, no review, no way to tell what changed or
why. Keeping them in a repo makes them ordinary code — diffable, testable, and
recoverable. `~/.claude/skills/<name>` becomes a symlink into this repo, so a skill
is edited in exactly one place.

## Skills

| Skill | What it does |
| --- | --- |
| [`slack-browser`](.claude/skills/slack-browser/) | Read Slack chats, triage unreads, draft replies via Playwright |
| [`outlook-browser`](.claude/skills/outlook-browser/) | Read and triage Outlook mail, draft replies via Playwright |
| [`whatsapp-browser`](.claude/skills/whatsapp-browser/) | Read WhatsApp chats and draft replies via Playwright |
| [`trello-browser`](.claude/skills/trello-browser/) | Read and update the Trello task board via Playwright |
| [`gh-create-pr`](.claude/skills/gh-create-pr/) | Open pull requests with `gh` using the safe body-file workflow |

The three messaging skills share a deliberate safety property: **they draft, they don't
send.** Sending happens only when you explicitly ask for it in the same request, and
only by clicking the app's real send button — never by a keystroke that could fire
early. `trello-browser` draws the same line one step further in: it will create, move,
and comment on cards freely, but archiving and deleting need an explicit ask.

Every browser skill's selectors and endpoints were verified against the live app rather
than guessed.

## Setup

Requires [uv](https://docs.astral.sh/uv/) and Python 3.13.

```bash
uv sync --all-groups     # install
uv run core skills link  # symlink skills into ~/.claude/skills
uv run prek install      # enable git hooks
```

`core skills link` refuses to overwrite a real directory at the user level, so an
existing skill is never silently destroyed. Move it into the repo first, or pass
`--force` once you're sure.

## Usage

```bash
uv run core skills status   # what's linked, what's missing, what's shadowing
uv run core skills link     # create or repoint links
uv run core skills unlink   # remove links (repo contents untouched)
```

`status` marks each skill `✓ linked`, `+ missing`, `~ foreign-link` (pointing
somewhere else), or `! unmanaged` (a real directory shadowing the repo copy).

## Development

```bash
make help      # list targets
make check     # lint, typecheck, test
make docs      # serve docs at localhost:8000
```

Quality gates run through [prek](https://github.com/j178/prek): formatting, linting,
type checking, secret scanning, and file hygiene on commit; tests and a strict docs
build on push. CI runs the same checks, so a green local commit means a green build.

## Layout

```text
.claude/skills/   skills — the point of the repo
src/core/         CLI that links them into ~/.claude/skills
tests/            tests for the linking logic
docs/             documentation, published to GitHub Pages
assets/           images and diagrams referenced by docs
```
