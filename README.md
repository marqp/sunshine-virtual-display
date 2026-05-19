# Sunshine Virtual Display (macOS) ☀️

An interactive command-line wrapper (CLI) built with Node.js/TypeScript to create **Native Virtual Displays on macOS** and automatically provision them for the **Sunshine** streaming server. Ideal for high-performance headless streaming without physical monitors.

## ✨ Features

- **Native Virtual Monitor**: Creates high-resolution ghost monitors without HDMI/Dummy adapters using pure macOS APIs.
- **Sunshine Auto-Provisioning**: Automatically discovers Sunshine installations (Homebrew or .app) and overwrites configurations on-the-fly (`sunshine.conf`).
- **Interactive Menu (Presets)**: Pre-configured bitrate profiles:
  - 🎮 Competitive (Ultra Low Latency)
  - ⚖️ Balanced (Smoothness and Clarity)
  - 🍿 Cinematic (Maximum Quality)
- **Audio Routing Control**: Interactive toggle to enable or disable system audio redirection to the tablet/client.
- **Zero Memory Leaks**: Robust IPC architecture with Parent Death Detection prevents virtual displays from persisting if the process exits unexpectedly (zombie processes).
- **High Performance (Concurrent Initialization)**: Native monitor allocation (which may take a few seconds) occurs in the background while the user interacts with the menu.
- **Turbo USB Mode (Wired)**: Automatic detection of Android devices via ADB for streaming over USB cable (Gnirehtet). Bypasses local network restrictions and drastically reduces latency.
- **Auto-Cleanup (Plug & Play)**: The program monitors the USB connection; if the cable is unplugged, the session is automatically terminated for security and resource efficiency.
- **Smart Automation Mode (`--ci`)**: Support for unattended execution. Automatically enables Turbo USB Mode if a device is detected and upgrades quality to **Cinematic** for wired connections.
- **Standalone Binaries**: Native macOS executables (x64 and ARM64) that run without requiring Node.js installed on the system.
- **Unit Tested**: Robust logic with >90% code coverage across system utilities, CLI menus, and configuration generation.

## 🔌 Turbo USB Mode (Wired Streaming)

This tool features a built-in **Turbo USB Mode** designed for scenarios where local Wi-Fi is unstable, ports are blocked by firewalls, or ultra-low latency is required.

### Why use it?

- **Bypass Firewalls**: Works even if your router blocks Sunshine's ports (e.g., in hotels or universities).
- **Reduced Latency**: Eliminates Wi-Fi jitter and interference.
- **Privacy**: Streaming data stays strictly on the USB cable.

### How it works

1. **Detection**: The CLI checks for an Android device with **USB Debugging** enabled.
2. **Reverse Tethering**: It spawns a `gnirehtet` instance, which creates a virtual network tunnel over ADB.
3. **Auto-Connection**: You connect Moonlight to the static IP `10.0.2.2`.
4. **Safety Lock**: The program monitors the physical connection. If you unplug the cable, the entire streaming session (including the virtual display) is automatically torn down.

## 🚀 Getting Started

### Prerequisites

- macOS (Apple Silicon or Intel)
- [Sunshine](https://app.lizardbyte.dev/Sunshine/) installed (via Homebrew or .pkg)
- **Optional (Turbo USB Mode):** `brew install android-platform-tools gnirehtet`

### Using Standalone Binaries (Recommended)

Download the latest version from the [Releases](https://github.com/your-username/sunshine-vd/releases) page and run:

```bash
chmod +x sunshine-virtual-display-arm64
./sunshine-virtual-display-arm64
```

### Cloning and Running (Development)

```bash
# 1. Clone the repository
git clone https://github.com/your-username/sunshine-vd.git
cd sunshine-vd

# 2. Install dependencies
npm install

# 3. Interactive Mode
npx tsx index.ts

# OR Automated Mode
npx tsx index.ts --ci
```

## 🧑‍💻 Development Commands

This repository follows standard linting, formatting, and testing rules:

```bash
npm run format # Formats the code with Prettier
npm run lint   # Checks code quality with ESLint
npm run test   # Runs unit tests with Vitest
npm run build  # Bundles the code for distribution
```

## 🛠️ Architecture and Engineering

To ensure stability and a professional DX:

- **Separation of Concerns (SoC)**: Modular architecture with dedicated managers for I/O, Processes, and CLI logic.
- **Atomic Write**: Configuration files are handled with fault tolerance using a `.tmp` + `renameSync` strategy.
- **Single-Binary Multi-process**: The compiled binary can spawn itself in a specialized daemon mode using `child_process.fork`, eliminating external script dependencies.
- **CI/CD**: Fully automated pipeline via GitHub Actions that validates every PR and generates native releases for macOS x64/arm64.

## 🤝 Contributing

Feel free to open Issues and send Pull Requests! Suggestions for new presets and native setup refinements are highly welcome.

## 📜 License

Distributed under the GPL-3.0 license. See [LICENSE](LICENSE) for more information.
