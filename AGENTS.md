# AGENTS.md

Guidelines and architecture reference for AI agents working in this repository.

## Overview
`sunshine-virtual-display` is an ultra-lightweight macOS CLI tool built in **Rust** that creates native macOS virtual displays, provisions Sunshine, and manages USB reverse tethering to Android clients via Gnirehtet.

## Architecture
- **Runtime & Toolchain**: Rust (Cargo, Tokio async runtime).
- **Core Modules**:
  - `src/display/`: Native macOS CoreGraphics / SkyLight SPIs via Objective-C runtime bridge (`native_virtual_display.m`) wrapped in safe RAII `VirtualDisplay` with automatic `Drop` cleanup.
  - `src/sunshine/`: Generates and atomically writes Sunshine configuration (`~/.config/sunshine/sunshine.conf`).
  - `src/gnirehtet/`: Supervises Gnirehtet reverse tethering, handles non-blocking asynchronous stream reading (`LinesCodec`), route isolation (`-r 10.0.2.2/32`), and Android VPN cleanup.
  - `src/adb/`: Device polling watcher, battery whitelist, and Moonlight app launch triggers.
  - `src/cli/`: Interactive prompts (`inquire`) and CLI argument parsing (`clap`).
  - `src/main.rs`: Application entrypoint, signal handling, and cancellation coordination.

## Commands
- **Dev**: `cargo run` / `cargo run -- --ci`
- **Test**: `cargo test`
- **Build release**: `cargo build --release` (compiles optimized ~2.1 MB Mach-O binary)

## Rules & Conventions
- Pure Rust codebase with zero runtime dependencies.
- Always drain `stdout` and `stderr` streams when spawning child processes to prevent OS pipe deadlocks.
- Ensure all resources rely on RAII or cancellation tokens for graceful teardown on exit.
- Keep tests updated (`tests/` and unit test modules). All tests must pass before committing.
