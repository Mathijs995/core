"""Command line entrypoint for the core toolkit."""

from __future__ import annotations

import typer

from core import skills
from core.skills import State

app = typer.Typer(help="Personal skills and automation toolkit.", no_args_is_help=True)
skills_app = typer.Typer(help="Manage Claude Code skills.", no_args_is_help=True)
app.add_typer(skills_app, name="skills")

_MARKS = {
    State.LINKED: ("✓", typer.colors.GREEN),
    State.MISSING: ("+", typer.colors.YELLOW),
    State.FOREIGN_LINK: ("~", typer.colors.YELLOW),
    State.UNMANAGED: ("!", typer.colors.RED),
}


def _echo(skill: skills.Skill, note: str = "") -> None:
    mark, color = _MARKS[skill.state]
    line = f"{typer.style(mark, fg=color)} {skill.name:<20} {note or skill.state}"
    typer.echo(line)


@skills_app.command("status")
def status() -> None:
    """Show how each repo skill maps into ~/.claude/skills."""
    found = skills.discover()
    if not found:
        typer.echo("No skills found in this repo.")
        raise typer.Exit(0)

    for skill in found:
        _echo(skill)

    pending = [s for s in found if s.needs_action]
    if pending:
        typer.echo(f"\n{len(pending)}/{len(found)} not linked — run: core skills link")


@skills_app.command("link")
def link(
    force: bool = typer.Option(
        False, "--force", help="Replace real directories at the user level."
    ),
) -> None:
    """Symlink every repo skill into ~/.claude/skills."""
    changed = 0
    blocked = 0
    for skill in skills.discover():
        try:
            if skills.link(skill, force=force):
                changed += 1
                _echo(skill, "linked")
        except FileExistsError as exc:
            blocked += 1
            typer.secho(f"! {skill.name:<20} {exc}", fg=typer.colors.RED)

    typer.echo(f"\n{changed} linked, {blocked} blocked.")
    if blocked:
        raise typer.Exit(1)


@skills_app.command("unlink")
def unlink() -> None:
    """Remove user-level symlinks that point into this repo."""
    removed = sum(skills.unlink(skill) for skill in skills.discover())
    typer.echo(f"{removed} unlinked.")


def main() -> None:
    """Console script entrypoint."""
    app()
