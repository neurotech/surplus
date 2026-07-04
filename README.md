# Surplus

WoW Addon Manager CLI for Linux.

## Quick Start

Install dependencies:

```bash
make setup
```

Run the CLI during development:

```bash
make cli ARGS="--help"
make cli ARGS="list --flavor retail"
```

Common shortcuts:

```bash
make list
make list FLAVOR=classic
make search QUERY="details" FLAVOR=retail
make update FLAVOR=retail
```

Run the compiled CLI:

```bash
make run ARGS="--help"
```

Package and verification tasks:

```bash
make check
make build
make test
make lint
```

The npm-style equivalents are also available:

```bash
pnpm run cli --help
pnpm run start -- --help
pnpm run check
```
