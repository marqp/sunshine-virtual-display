use clap::Parser;
use colored::Colorize;
use inquire::{Confirm, Select};

use crate::adb::{
    get_adb_device_id, get_device_screen_size, has_gnirehtet, is_moonlight_installed,
};

#[derive(Parser, Debug)]
#[command(
    name = "sunshine-vd",
    version,
    about = "macOS native virtual display and Sunshine provisioner"
)]
pub struct CliArgs {
    /// Enable automated headless/CI mode
    #[arg(long)]
    pub ci: bool,

    /// Custom width for the virtual display
    #[arg(long)]
    pub width: Option<u32>,

    /// Custom height for the virtual display
    #[arg(long)]
    pub height: Option<u32>,
}

#[derive(Debug, Clone, Copy)]
pub struct QualityProfile {
    pub name: &'static str,
    pub max_bit: u32,
}

impl std::fmt::Display for QualityProfile {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.name)
    }
}

pub const PROFILE_COMPETITIVE: QualityProfile = QualityProfile {
    name: "🎮 Competitive (Ultra Low Latency - 15 Mbps)",
    max_bit: 15000,
};

pub const PROFILE_BALANCED: QualityProfile = QualityProfile {
    name: "⚖️  Balanced (Smoothness & Clarity - 30 Mbps)",
    max_bit: 30000,
};

pub const PROFILE_CINEMATIC: QualityProfile = QualityProfile {
    name: "🍿 Cinematic (Maximum Quality - 60 Mbps)",
    max_bit: 60000,
};

pub struct RunConfig {
    pub max_bitrate: u32,
    pub use_usb_tethering: bool,
    pub connected_device_id: Option<String>,
    pub enable_audio: bool,
    pub auto_launch_moonlight: bool,
    pub width: u32,
    pub height: u32,
}

pub async fn run_menu(args: &CliArgs) -> Option<RunConfig> {
    let adb_device_id = get_adb_device_id().await;
    let detected_screen = get_device_screen_size(adb_device_id.as_deref()).await;
    let gnirehtet_ready = has_gnirehtet().await;

    let mut use_usb_tethering = false;
    let mut auto_launch_moonlight = false;
    let max_bitrate: u32;
    let enable_audio: bool;

    let mut selected_width = args.width.unwrap_or(1920);
    let mut selected_height = args.height.unwrap_or(1080);

    let is_16_10 = if let Some((w, h)) = detected_screen {
        let aspect = w as f64 / h as f64;
        (aspect - 1.6).abs() < 0.05
    } else {
        false
    };

    if args.ci {
        println!("{}", "🤖 --ci mode active.".cyan());

        if let Some((w, h)) = detected_screen {
            if is_16_10 && args.width.is_none() && args.height.is_none() {
                println!(
                    "{}",
                    format!(
                        "📱 Detected 16:10 tablet display ({}x{}). Auto-applying 1920x1200 resolution (0% letterboxing).",
                        w, h
                    )
                    .green()
                );
                selected_width = 1920;
                selected_height = 1200;
            }
        }

        if let Some(ref dev_id) = adb_device_id {
            if gnirehtet_ready {
                println!(
                    "{}",
                    "🔌 Android device detected. Automatically enabling Turbo USB Mode (Gnirehtet)..."
                        .green()
                );
                use_usb_tethering = true;

                if is_moonlight_installed(dev_id).await {
                    println!(
                        "{}",
                        "📱 Moonlight detected on tablet. Will open automatically.".cyan()
                    );
                    auto_launch_moonlight = true;
                }
            }
        }

        if use_usb_tethering {
            println!(
                "{}",
                "✨ Turbo USB detected: Automatically selecting Cinematic profile (60 Mbps)..."
                    .cyan()
            );
            max_bitrate = 60000;
        } else {
            println!(
                "{}",
                "⚖️  Standard network: Automatically selecting Balanced profile (30 Mbps)..."
                    .cyan()
            );
            max_bitrate = 30000;
        }
        enable_audio = false;
    } else {
        if let Some((w, h)) = detected_screen {
            if is_16_10 && args.width.is_none() && args.height.is_none() {
                let msg = format!(
                    "📱 Detected 16:10 tablet screen ({}x{}). Use 1920x1200 to eliminate letterboxing?",
                    w, h
                );
                let use_16_10 = Confirm::new(&msg).with_default(true).prompt().ok()?;
                if use_16_10 {
                    selected_width = 1920;
                    selected_height = 1200;
                }
            }
        }

        if let Some(ref dev_id) = adb_device_id {
            if gnirehtet_ready {
                let tether_ans = Confirm::new(
                    "🔌 Android device detected via cable. Enable Turbo USB Mode (Gnirehtet)?",
                )
                .with_default(true)
                .prompt()
                .ok()?;

                use_usb_tethering = tether_ans;

                if use_usb_tethering && is_moonlight_installed(dev_id).await {
                    let launch_ans =
                        Confirm::new("📱 Moonlight detected on tablet. Open it automatically?")
                            .with_default(true)
                            .prompt()
                            .ok()?;
                    auto_launch_moonlight = launch_ans;
                }
            } else {
                println!(
                    "{}",
                    "🔌 Android device detected, but Gnirehtet is not installed.".yellow()
                );
                println!(
                    "{}",
                    "💡 Tip: Install with `brew install gnirehtet` to enable Turbo USB Mode.\n"
                        .cyan()
                );
            }
        }

        let profiles = vec![PROFILE_COMPETITIVE, PROFILE_BALANCED, PROFILE_CINEMATIC];
        let selected_profile = Select::new("✨ Select streaming quality:", profiles)
            .with_starting_cursor(2) // Default to Cinematic
            .prompt()
            .ok()?;

        max_bitrate = selected_profile.max_bit;

        let audio_ans = Confirm::new("🔊 Stream Mac audio to tablet?")
            .with_default(false)
            .prompt()
            .ok()?;

        enable_audio = audio_ans;
    }

    Some(RunConfig {
        max_bitrate,
        use_usb_tethering,
        connected_device_id: adb_device_id,
        enable_audio,
        auto_launch_moonlight,
        width: selected_width,
        height: selected_height,
    })
}
