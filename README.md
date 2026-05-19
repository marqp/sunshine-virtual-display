# Sunshine Virtual Display (macOS) ☀️

I "vibecoded" this little app because I wanted something like Apple Sidecar, but for my Android tablet (yes, I'm balling on a budget). It was a fun process, so I decided to share it here. As a bonus, it works as a third monitor even on a base M1 MacBook Air!

## 🚀 Quick Install

Install the latest version globally in one step (no Node.js or cloning required):

```bash
curl -sSL https://raw.githubusercontent.com/marqp/sunshine-virtual-display/main/install.sh | bash
```

## 🛠️ How it Works

This tool is a specialized wrapper that bridges macOS native capabilities with the [Sunshine](https://app.lizardbyte.dev/Sunshine/) streaming server:

1.  **Native Display Creation**: It uses a background daemon to talk to macOS APIs and create a "ghost" virtual monitor. No HDMI dummy plugs needed.
2.  **Auto-Provisioning**: It automatically finds your Sunshine config and overwrites it to target the new virtual screen with optimized bitrate presets.
3.  **Turbo USB Mode**: If it detects an Android device via cable, it automatically sets up a high-speed network tunnel (via Gnirehtet) and bumps the quality to **Cinematic** (60Mbps).
4.  **Clean Teardown**: When you close the app (Ctrl+C), it's programmed to clean up after itself—destroying the virtual monitor and stopping the streams—so you don't end up with zombie displays.

## 📖 Usage

```bash
# Start the interactive menu
sunshine-vd

# Automation mode (great for startup scripts)
sunshine-vd --ci
```

## 🤝 Prerequisites

- **macOS** (Intel or Apple Silicon)
- **Sunshine** installed (`brew install sunshine`)
- **Optional (Turbo USB)**: `brew install android-platform-tools gnirehtet`

---

_Distributed under the GPL-3.0 license._
