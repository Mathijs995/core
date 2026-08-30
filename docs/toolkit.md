# Toolkit

`core` is a small Typer CLI whose only job is wiring this repo's skills into
`~/.claude/skills`.

## Commands

```bash
uv run core skills status   # what's linked, missing, or shadowing
uv run core skills link     # create or repoint links
uv run core skills unlink   # remove links (repo contents untouched)
```

## States

`status` classifies every skill in the repo by what sits at the user level:

| Mark | State | Meaning |
| --- | --- | --- |
| `✓` | `linked` | Symlinked to this repo — nothing to do |
| `+` | `missing` | Not installed at the user level yet |
| `~` | `foreign-link` | A symlink pointing somewhere other than this repo |
| `!` | `unmanaged` | A **real directory** shadowing the repo copy |

## Why `unmanaged` blocks

Linking replaces whatever is at `~/.claude/skills/<name>`. If that path is a real
directory, it may hold a skill that exists *only* there — and replacing it with a
symlink would destroy the sole copy.

So `link` refuses, names the path, and exits non-zero:

```console
$ uv run core skills link
! my-skill  /Users/me/.claude/skills/my-skill is a real directory, not a link.
            Move it into the repo first, or pass force to replace it.
```

Move the directory into `.claude/skills/` and link again, or pass `--force` once
you have confirmed the repo copy is the one you want. `unlink` is symmetric: it
only removes symlinks that point into this repo, so an unmanaged directory is never
deleted by accident.

## Design

The linking logic lives in `src/core/skills.py` as pure functions over explicit
paths — `discover()`, `link()`, `unlink()` — with the Typer commands in
`src/core/cli.py` doing nothing but formatting. Because the path arguments are
injected rather than read from globals, the tests exercise the real logic against
temporary directories and never touch your actual `~/.claude`.
