# AGENTS.md

Guidelines and architecture reference for AI agents working in this repository.

## Overview

`sunshine-virtual-display` is a macOS CLI tool built with **Bun** and **TypeScript** that creates native macOS virtual displays, provisions Sunshine, and manages USB reverse tethering to Android clients via Gnirehtet.

## Architecture

- **Runtime & Toolchain**: Bun (TypeScript execution, Vitest runner, standalone compiler).
- **Core Modules**:
  - `src/virtual-display.ts`: TypeScript wrapper around native `virtual_display.node` (CoreGraphics / SkyLight SPIs).
  - `src/daemon.ts`: Background daemon maintaining the virtual display handle via IPC.
  - `src/sunshine.ts` & `src/io.ts`: Generates and atomically writes Sunshine configuration (`~/.config/sunshine/sunshine.conf`).
  - `src/gnirehtet.ts`: Supervises Gnirehtet reverse tethering, handles non-blocking stream draining, route isolation (`-r 10.0.2.2/32`), and Android VPN cleanup.
  - `src/process-manager.ts`: Centralized teardown and signal handling (`SIGINT`, `SIGTERM`, USB unplug).
  - `src/cli.ts`: Interactive and CI automated prompt workflows.
  - `index.ts`: Application entrypoint and orchestrator.

## Commands

- **Dev**: `bun run dev` / `bun run dev --ci`
- **Test**: `bun run test` (Vitest)
- **Lint & Format**: `bun run lint` / `bun run format`
- **Build standalone**: `bun run package` (compiles arm64 & x64 executables)

## Rules & Conventions

- Pure TypeScript everywhere.
- Always drain `stdout` and `stderr` streams when spawning child processes to prevent OS pipe deadlocks.
- Register all spawned resources and timers in `ProcessManager` for cleanup on exit.
- Keep tests updated (`src/*.test.ts`). All tests must pass before committing.
