.DEFAULT_GOAL := help
.PHONY: help install link status check lint types test docs docs-build hooks clean

help: ## Show available targets
	@grep -E '^[a-z-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN{FS=":.*?## "}{printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2}'

install: ## Install dependencies and git hooks
	uv sync --all-groups
	uv run prek install

link: ## Symlink skills into ~/.claude/skills
	uv run core skills link

status: ## Show skill link status
	uv run core skills status

check: lint types test ## Run all quality gates

lint: ## Lint and format
	uv run ruff check --fix src tests
	uv run ruff format src tests

types: ## Type check
	uv run ty check

test: ## Run tests with coverage
	uv run pytest --cov --cov-report=term-missing

docs: ## Serve docs locally
	uv run mkdocs serve

docs-build: ## Build docs strictly
	uv run mkdocs build --strict

hooks: ## Run all prek hooks against every file
	uv run prek run --all-files

clean: ## Remove build and cache artifacts
	rm -rf site .pytest_cache .ruff_cache .coverage htmlcov
	find . -type d -name __pycache__ -not -path './.venv/*' -exec rm -rf {} +
