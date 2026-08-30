"""Tests for the skill linking logic."""

from __future__ import annotations

from pathlib import Path

import pytest

from core import skills
from core.skills import State


@pytest.fixture
def dirs(tmp_path: Path) -> tuple[Path, Path]:
    """A repo skills dir holding one skill, and an empty user skills dir."""
    repo = tmp_path / "repo" / ".claude" / "skills"
    user = tmp_path / "home" / ".claude" / "skills"
    (repo / "demo").mkdir(parents=True)
    (repo / "demo" / "SKILL.md").write_text("---\nname: demo\n---\n")
    user.mkdir(parents=True)
    return repo, user


def only(repo: Path, user: Path) -> skills.Skill:
    found = skills.discover(repo, user)
    assert len(found) == 1
    return found[0]


def test_discover_ignores_files_and_dotdirs(dirs: tuple[Path, Path]) -> None:
    repo, user = dirs
    (repo / "SKILLS.md").write_text("not a skill")
    (repo / ".hidden").mkdir()

    assert [s.name for s in skills.discover(repo, user)] == ["demo"]


def test_discover_on_missing_repo_dir_is_empty(tmp_path: Path) -> None:
    assert skills.discover(tmp_path / "nope", tmp_path) == []


def test_missing_then_linked(dirs: tuple[Path, Path]) -> None:
    repo, user = dirs
    assert only(repo, user).state is State.MISSING

    assert skills.link(only(repo, user)) is True

    linked = only(repo, user)
    assert linked.state is State.LINKED
    assert linked.needs_action is False
    assert (user / "demo" / "SKILL.md").read_text().startswith("---")


def test_link_is_idempotent(dirs: tuple[Path, Path]) -> None:
    repo, user = dirs
    skills.link(only(repo, user))

    assert skills.link(only(repo, user)) is False


def test_foreign_link_is_repointed(dirs: tuple[Path, Path], tmp_path: Path) -> None:
    repo, user = dirs
    elsewhere = tmp_path / "elsewhere"
    elsewhere.mkdir()
    (user / "demo").symlink_to(elsewhere, target_is_directory=True)

    assert only(repo, user).state is State.FOREIGN_LINK
    assert skills.link(only(repo, user)) is True
    assert only(repo, user).state is State.LINKED


def test_unmanaged_dir_is_never_clobbered_by_default(dirs: tuple[Path, Path]) -> None:
    repo, user = dirs
    (user / "demo").mkdir()
    (user / "demo" / "SKILL.md").write_text("user's own copy")

    assert only(repo, user).state is State.UNMANAGED
    with pytest.raises(FileExistsError):
        skills.link(only(repo, user))

    assert (user / "demo" / "SKILL.md").read_text() == "user's own copy"


def test_unmanaged_dir_replaced_with_force(dirs: tuple[Path, Path]) -> None:
    repo, user = dirs
    (user / "demo").mkdir()
    (user / "demo" / "SKILL.md").write_text("user's own copy")

    assert skills.link(only(repo, user), force=True) is True
    assert only(repo, user).state is State.LINKED


def test_unlink_removes_only_our_links(dirs: tuple[Path, Path]) -> None:
    repo, user = dirs
    skills.link(only(repo, user))

    assert skills.unlink(only(repo, user)) is True
    assert not (user / "demo").exists()
    assert (repo / "demo" / "SKILL.md").exists(), "source must survive"


def test_unlink_leaves_unmanaged_dirs_alone(dirs: tuple[Path, Path]) -> None:
    repo, user = dirs
    (user / "demo").mkdir()

    assert skills.unlink(only(repo, user)) is False
    assert (user / "demo").is_dir()
