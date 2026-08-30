# core

Personal skills and automation toolkit — the source of truth for the Claude Code
skills I use daily, plus the CLI that installs them.

## Why a repo for skills

Skills are markdown plus a few helper scripts. Left loose in `~/.claude/skills/`,
they have no history and no review: you cannot tell what changed, when, or why, and
a bad edit is unrecoverable. Moving them into a repo makes them ordinary code.

`~/.claude/skills/<name>` becomes a symlink into this repo, so each skill is edited
in exactly one place and there are no divergent copies to reconcile.

## Getting started

```bash
uv sync --all-groups
uv run core skills link
uv run prek install
```

See [Toolkit](toolkit.md) for what the CLI does and how it protects existing
skills, and [Skills](skills/index.md) for what each skill covers.

## Layout

| Path | Contents |
| --- | --- |
| `.claude/skills/` | The skills — the point of the repo |
| `src/core/` | CLI that links skills into `~/.claude/skills` |
| `tests/` | Tests for the linking logic |
| `docs/` | This documentation |
| `assets/` | Images and diagrams referenced by docs |
