"""Link this repo's Claude Code skills into the user-level skills directory.

The repo is the source of truth: ``~/.claude/skills/<name>`` becomes a symlink
pointing at ``<repo>/.claude/skills/<name>``, so a skill is edited in one place
and version-controlled.
"""

from __future__ import annotations

import os
import shutil
from collections.abc import Iterator
from dataclasses import dataclass
from enum import StrEnum
from pathlib import Path

REPO_SKILLS_DIR = Path(__file__).resolve().parents[2] / ".claude" / "skills"
USER_SKILLS_DIR = Path.home() / ".claude" / "skills"


class State(StrEnum):
    """How a repo skill currently relates to the user-level skills directory."""

    LINKED = "linked"
    """Correctly symlinked to this repo."""

    MISSING = "missing"
    """Not present at the user level at all."""

    FOREIGN_LINK = "foreign-link"
    """A symlink pointing somewhere other than this repo."""

    UNMANAGED = "unmanaged"
    """A real directory shadowing the repo skill — would be overwritten by a link."""


@dataclass(frozen=True)
class Skill:
    """A skill in this repo and the state of its user-level counterpart."""

    name: str
    source: Path
    target: Path
    state: State

    @property
    def needs_action(self) -> bool:
        """Whether linking would change anything for this skill."""
        return self.state is not State.LINKED


def discover(
    repo_dir: Path = REPO_SKILLS_DIR, user_dir: Path = USER_SKILLS_DIR
) -> list[Skill]:
    """Return every skill in ``repo_dir`` paired with its user-level state."""
    return sorted(_iter_skills(repo_dir, user_dir), key=lambda s: s.name)


def _iter_skills(repo_dir: Path, user_dir: Path) -> Iterator[Skill]:
    if not repo_dir.is_dir():
        return
    for source in repo_dir.iterdir():
        if not source.is_dir() or source.name.startswith("."):
            continue
        target = user_dir / source.name
        yield Skill(source.name, source, target, _state_of(source, target))


def _state_of(source: Path, target: Path) -> State:
    if target.is_symlink():
        resolved = Path(os.path.realpath(target))
        return State.LINKED if resolved == source.resolve() else State.FOREIGN_LINK
    if target.exists():
        return State.UNMANAGED
    return State.MISSING


def link(skill: Skill, *, force: bool = False) -> bool:
    """Point ``skill.target`` at ``skill.source``.

    Returns ``True`` when a link was created or repointed, ``False`` when the
    skill was already correctly linked.

    Raises:
        FileExistsError: when the target is a real directory and ``force`` is
            not set. Refusing here prevents silently destroying a skill that
            only exists at the user level.
    """
    if skill.state is State.LINKED:
        return False
    if skill.state is State.UNMANAGED and not force:
        raise FileExistsError(
            f"{skill.target} is a real directory, not a link. "
            "Move it into the repo first, or pass force to replace it."
        )

    skill.target.parent.mkdir(parents=True, exist_ok=True)
    if skill.target.is_symlink() or skill.target.exists():
        _remove(skill.target)
    skill.target.symlink_to(skill.source, target_is_directory=True)
    return True


def unlink(skill: Skill) -> bool:
    """Remove ``skill.target`` when it is a symlink into this repo.

    Returns ``True`` when a link was removed. Real directories are never
    touched, so an unmanaged user-level skill survives.
    """
    if skill.state is not State.LINKED:
        return False
    skill.target.unlink()
    return True


def _remove(path: Path) -> None:
    if path.is_symlink() or path.is_file():
        path.unlink()
    else:
        shutil.rmtree(path)
