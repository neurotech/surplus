SHELL := /usr/bin/env bash

ARGS ?= --help
FLAVOR ?= retail
PNPM ?= pnpm
QUERY ?=

.DEFAULT_GOAL := help

.PHONY: help setup cli run list update search build test lint lint-fix typecheck check clean

help:
	@printf "Surplus CLI tasks\n\n"
	@printf "Usage:\n"
	@printf "  make setup              Install dependencies\n"
	@printf "  make cli ARGS=\"...\"     Run the TypeScript CLI for development\n"
	@printf "  make run ARGS=\"...\"     Build and run the compiled CLI\n"
	@printf "  make list               List retail addons; set FLAVOR=classic if needed\n"
	@printf "  make update             Check retail updates; set FLAVOR=classic if needed\n"
	@printf "  make search QUERY=\"...\" Search CurseForge for retail addons\n"
	@printf "  make check              Run typecheck, lint, and tests\n"
	@printf "  make build              Compile to dist/\n"
	@printf "  make test               Run tests\n"
	@printf "  make lint               Run Biome checks\n"
	@printf "  make lint-fix           Format and apply safe lint fixes\n"
	@printf "  make typecheck          Run TypeScript typecheck\n"
	@printf "  make clean              Remove build output\n\n"
	@printf "Examples:\n"
	@printf "  make cli ARGS=\"list --flavor retail\"\n"
	@printf "  make list FLAVOR=classic\n"
	@printf "  make search QUERY=\"details\" FLAVOR=retail\n"
	@printf "  make cli ARGS=\"install https://github.com/owner/repo --flavor classic\"\n"
	@printf "  make run ARGS=\"--help\"\n"

setup:
	$(PNPM) install

cli:
	$(PNPM) exec tsx bin/surplus.ts $(ARGS)

run: build
	node dist/bin/surplus.js $(ARGS)

list:
	$(PNPM) exec tsx bin/surplus.ts list --flavor $(FLAVOR)

update:
	$(PNPM) exec tsx bin/surplus.ts update --flavor $(FLAVOR)

search:
	@test -n "$(QUERY)" || (printf "Usage: make search QUERY=\"addon name\" FLAVOR=retail\n" && exit 2)
	$(PNPM) exec tsx bin/surplus.ts search "$(QUERY)" --flavor $(FLAVOR)

build:
	$(PNPM) run build

test:
	$(PNPM) run test

lint:
	$(PNPM) run lint

lint-fix:
	$(PNPM) run lint:fix

typecheck:
	$(PNPM) run typecheck

check:
	$(PNPM) run check

clean:
	rm -rf dist
