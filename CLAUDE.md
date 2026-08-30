# core

Personal skills and automation toolkit. The skills in `.claude/skills/` are the
point of this repo; `src/core/` is the CLI that links them into `~/.claude/skills`.

## Working here

- **uv, Python 3.13.** Add dependencies with `uv add` — never hand-edit
  `pyproject.toml`, the `uv-lock` hook will fail the commit.
- **Run checks with `make check`** (lint, types, tests) before committing.
  `make hooks` runs the full prek suite over every file.
- **Keep logic out of the CLI.** Behaviour belongs in pure functions taking
  explicit paths (see `src/core/skills.py`); `cli.py` only formats output.
- Type annotations and Google-style docstrings are enforced by ruff and `ty`.

## Editing skills

Skills are symlinked into `~/.claude/skills`, so edits here take effect
immediately — there is no sync step, and no second copy to update.

When changing a browser skill (`slack-`, `outlook-`, `whatsapp-browser`), **verify
selectors against the live application** before writing them down. These skills
document verified DOM facts; a guessed selector fails silently and erodes the
reason the repo exists.

Preserve their safety properties: draft by default, send only on an explicit
request in the same turn, and only via the app's real send button — never a
keystroke. Slack and WhatsApp send on <kbd>Enter</kbd>, Outlook on
<kbd>Ctrl</kbd>+<kbd>Enter</kbd>.
