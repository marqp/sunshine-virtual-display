# Sunshine Virtual Display (macOS) ☀️

Ultra-lightweight native macOS CLI tool built in **Rust** to create native virtual displays and automatically provision Sunshine for headless streaming to Android tablets (via Wi-Fi or high-speed USB reverse tethering).

## 🚀 Quick Install

Install the latest standalone binary globally:

```bash
curl -sSL https://raw.githubusercontent.com/marqp/sunshine-virtual-display/main/install.sh | bash
```

## 🛠️ How it Works

1. **Native Display Creation**: Directly links to macOS Quartz/CoreGraphics APIs to spawn a native virtual display with RAII lifecycle cleanup.
2. **Auto-Provisioning & Hardware Lock**: Generates and atomically writes optimized Sunshine configuration (`~/.config/sunshine/sunshine.conf`) locking to Apple Silicon VideoToolbox hardware encoding (`vt_software=disabled`, `hevc_mode=2`, `vt_coder=cabac`).
3. **16:10 Aspect Ratio Auto-Matching**: Detects physical tablet screen dimensions (e.g. 2880x1800) and automatically maps to matching resolutions (e.g. 1920x1200) to eliminate black bars (letterboxing) and font blur.
4. **Turbo USB Mode**: Detects connected Android devices over USB, sets up a reverse network tunnel with route isolation via Gnirehtet, whitelists battery limits, and automatically launches Moonlight on the tablet.
5. **Lifecycle & Clean Teardown**: Handles process signals (`SIGINT`/`SIGTERM`) and USB unplug events, destroying the virtual display and terminating all tunnels cleanly.

## 📖 Usage

```bash
# Interactive mode
sunshine-vd

# Automated / CI mode
sunshine-vd --ci
```

## 📱 Recommended Moonlight Client Settings (Android)

For the lowest possible latency (<15 ms) and razor-sharp text:
- **Video Codec**: Select **HEVC** (H.265).
- **Frame Pacing**: Set to **"Prefer lowest latency"** (bypasses Moonlight's client-side jitter buffer).
- **Video Bitrate**: Set to **50–60 Mbps** over USB.
- **Resolution & Frame Rate**: Match the host resolution (e.g. 1920x1200 or 2880x1800) at 60 FPS.

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
