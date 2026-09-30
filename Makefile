# Developer tasks. Run `make` to list them.
.DEFAULT_GOAL := help
.PHONY: help setup lint fmt typecheck test coverage bench mutation build binary docker docs docs-serve demo clean

help: ## List the available targets
	@awk 'BEGIN { FS = ":.*## " } /^[a-z-]+:.*## / { printf "  %-12s %s\n", $$1, $$2 }' $(MAKEFILE_LIST)

setup: ## Install dependencies and the pre-commit hooks
	npm ci
	@command -v pre-commit >/dev/null && pre-commit install || echo "pre-commit not found; skipping hook install"

lint: ## Check formatting and lint rules with Biome
	npm run lint

fmt: ## Format and fix the code in place
	npm run check

typecheck: ## Type-check without emitting
	npm run typecheck

test: ## Run the unit, property, README, and integration tests
	npm test

coverage: ## Run the tests with coverage
	npm run test:coverage

bench: build ## Run the benchmark and compare it with bench/baseline.json
	npm run bench

mutation: ## Run mutation testing with Stryker
	npm run mutation

build: ## Compile TypeScript to dist/
	npm run build

binary: ## Compile a standalone executable for this machine into out/ (needs Bun)
	node scripts/compile.mjs out/mcp-lint

docker: ## Build the container image as mcp-lint:local
	docker build -t mcp-lint:local .

docs: ## Build the documentation site into site/ (needs Python)
	pip install -r docs/requirements.txt
	mkdocs build --strict

docs-serve: ## Serve the documentation site with live reload
	mkdocs serve

demo: build ## Record docs/assets/demo.gif with vhs
	vhs docs/demo.tape

clean: ## Remove build output
	rm -rf dist out coverage reports site .stryker-tmp
