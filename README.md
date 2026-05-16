# Sunshine Virtual Display (macOS) ☀️

An interactive command-line wrapper (CLI) built with Node.js/TypeScript to create **Native Virtual Displays on macOS** and automatically provision them for the **Sunshine** streaming server. Ideal for high-performance headless streaming without physical monitors.

## ✨ Features

- **Native Virtual Monitor**: Creates high-resolution ghost monitors without HDMI/Dummy adapters using pure macOS APIs.
- **Sunshine Auto-Provisioning**: Automatically discovers Sunshine installations (Homebrew or .app) and overwrites configurations on-the-fly (`sunshine.conf`).
- **Interactive Menu (Presets)**: Pre-configured bitrate profiles:
  - 🎮 Competitive (Ultra Low Latency)
  - ⚖️ Balanced (Smoothness and Clarity)
  - 🍿 Cinematic (Maximum Quality)
- **Zero Memory Leaks**: Robust IPC architecture with Parent Death Detection prevents virtual displays from persisting if the process exits unexpectedly (zombie processes).
- **High Performance (Concurrent Initialization)**: Native monitor allocation (which may take a few seconds) occurs in the background while the user interacts with the menu. This eliminates perceived startup latency.
- **Turbo USB Mode (Wired)**: Automatic detection of Android devices via ADB for streaming over USB cable (Gnirehtet). Bypasses local network restrictions and drastically reduces latency.
- **Auto-Cleanup (Plug & Play)**: The program monitors the USB connection; if the cable is unplugged, the session is automatically terminated for security and resource efficiency.
- **Headless/Automation Mode (`--ci`)**: Support for unattended execution (skipping interactive menus) using the Balanced profile by default. Perfect for macOS Shortcuts, KDE Connect, or startup scripts.
- **Modern Compatibility**: ESM support and hybrid compilation; works perfectly with Bun and Node.js.

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
4. **Safety Lock**: The program monitors the physical connection. If you unplug the cable, the entire streaming session (including the virtual display) is automatically torn down to save power and maintain privacy.

### Troubleshooting
- **Device not detected?** Ensure "USB Debugging" is ON in Android Developer Options.
- **Connection failed?** Make sure you accepted the VPN prompt on your Android screen.
- **Tools missing?** Run `brew install android-platform-tools gnirehtet`.

## 🚀 Getting Started

### Prerequisites

- macOS (Apple Silicon or Intel)
- [Node.js](https://nodejs.org/) v18+ or [Bun](https://bun.sh/)
- [Sunshine](https://app.lizardbyte.dev/Sunshine/) installed (via Homebrew or .pkg)
- **Optional (Turbo USB Mode):** `brew install android-platform-tools gnirehtet`

### Cloning and Running

```bash
# 1. Clone the repository
git clone https://github.com/your-username/sunshine-vd.git
cd sunshine-vd

# 2. Install dependencies
npm install

# 3. Interactive Mode
npx tsx index.ts

# OR Automated Mode (Bypasses the menu and starts with Balanced profile)
npx tsx index.ts --ci
```

*(Tip: For faster startup, you can run with `bun run index.ts`)*

## 🧑‍💻 Development Commands

This repository follows standard linting and formatting rules:

```bash
npm run format # Formats the code
npm run lint   # Checks code quality with ESLint
```

## 🛠️ Architecture and Engineering (Under the Hood)

To ensure stability, security, and avoid common process management bugs:

- **Atomic Write**: The Sunshine configuration file (`sunshine.conf`) is handled with fault tolerance. We write data to a `.tmp` file and use `fs.renameSync` for an OS-level atomic write, preventing corrupted files if the user hits `Ctrl+C` at the wrong time.
- **Isolation and Concurrency**: Virtual Display allocation happens in a sub-process (`display-daemon.js`). Besides protecting the main process from crashes in native C++ APIs, this allows us to provision the screen concurrently in the background while the user navigates the menus.
- **Graceful Degradation**: Upon exit, the script prioritizes sending `SIGTERM` signals to allow Sunshine to clean up ports and sockets properly before forcing a kill.

## 🤝 Contributing

Feel free to open Issues and send Pull Requests! Suggestions for new presets and native setup refinements are highly welcome.

## 📜 License

Distributed under the GPL-3.0 license. See [LICENSE](LICENSE) for more information.
