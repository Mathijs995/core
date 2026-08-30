# Contributing

## Setup

```bash
uv sync --all-groups
uv run prek install
```

## Quality gates

[prek](https://github.com/j178/prek) runs the checks; `make check` runs the same
tools directly while iterating.

**On commit** — fast checks only, so the loop stays tight:

- File integrity: large files, merge conflicts, symlinks, line endings, private keys
- `gitleaks` secret scanning
- `ruff check --fix` and `ruff format`
- `pyupgrade --py313-plus`
- `markdownlint`, `yamllint --strict`, `actionlint`, `shellcheck`, `codespell`
- `uv lock` freshness and `pyproject.toml` sorting
- `ty` type checking

**On push** — the slower gates:

- `pytest`
- `mkdocs build --strict`

CI runs the identical set, so a clean local push means a clean build.

## Conventions

- **Python 3.13**, managed by uv. Add dependencies with `uv add`, never by editing
  `pyproject.toml` by hand — the lockfile check will catch it.
- **Type annotations everywhere.** `ruff`'s `ANN` rules are on and `ty` runs on
  every commit.
- **Google-style docstrings** on public functions. Document the *why*, especially
  for anything that refuses to act.
- **Test the logic, not the CLI.** Keep behaviour in pure functions that take
  explicit paths; the Typer layer stays thin enough not to need its own tests.

## Adding a skill

See [Writing a new skill](skills/index.md#writing-a-new-skill). The rule that
matters most: verify against the real application before writing anything down.
