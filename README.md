# Sunshine Virtual Display (macOS) ☀️

Ultra-lightweight native macOS CLI tool built in **Rust** to create native virtual displays and automatically provision Sunshine for headless streaming to Android tablets (via Wi-Fi or high-speed USB reverse tethering).

## 🚀 Quick Install

Install the latest standalone binary globally:

```bash
curl -sSL https://raw.githubusercontent.com/marqp/sunshine-virtual-display/main/install.sh | bash
```

## 🛠️ How it Works

1. **Native Display Creation**: Directly links to macOS Quartz/CoreGraphics APIs to spawn a native virtual display with RAII lifecycle cleanup.
2. **Auto-Provisioning**: Generates and applies optimized Sunshine configuration (`~/.config/sunshine/sunshine.conf`) targeting the virtual monitor.
3. **Turbo USB Mode**: Detects connected Android devices over USB, sets up a reverse network tunnel with route isolation via Gnirehtet, optimizes bitrate, and automatically launches Moonlight on the tablet.
4. **Lifecycle & Clean Teardown**: Handles process signals (`SIGINT`/`SIGTERM`) and USB unplug events, destroying the virtual display and terminating all tunnels cleanly.

## 📖 Usage

```bash
# Interactive mode
sunshine-vd

# Automated / CI mode
sunshine-vd --ci
```

## 🤝 Prerequisites

- **macOS** (Apple Silicon or Intel)
- **Sunshine** (`brew install sunshine`)
- **Optional (Turbo USB)**: ADB and Gnirehtet (`brew install android-platform-tools gnirehtet`)

## 💻 Development

```bash
cargo run            # Run interactive CLI
cargo run -- --ci    # Run in automated CI mode
cargo test           # Run all unit and integration tests
cargo build --release # Build optimized standalone binary (~2.1 MB)
```

---

_Distributed under the GPL-3.0 license._
