mod adb;
mod cli;
mod display;
mod gnirehtet;
mod sunshine;

use clap::Parser;
use colored::Colorize;
use std::process::Stdio;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;
use tokio::process::Command;
use tokio::sync::Notify;

use crate::adb::{
    cleanup_stale_gnirehtet, find_sunshine_bin, get_adb_device_id, launch_moonlight,
    whitelist_gnirehtet_battery,
};
use crate::cli::{run_menu, CliArgs};
use crate::display::VirtualDisplay;
use crate::gnirehtet::spawn_gnirehtet_tunnel;
use crate::sunshine::{
    generate_sunshine_config, get_sunshine_conf_path, write_sunshine_config_atomic,
};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let args = CliArgs::parse();

    println!("{}", "=========================================".cyan());
    println!("{}", " ☀️ Sunshine Native Auto-Provision (RS) ☀️ ".cyan());
    println!("{}", "=========================================\n".cyan());

    let sunshine_bin = match find_sunshine_bin().await {
        Ok(b) => b,
        Err(e) => {
            eprintln!("{}", format!("❌ {}", e).red());
            std::process::exit(1);
        }
    };

    let config = match run_menu(&args).await {
        Some(c) => c,
        None => {
            println!("{}", "❌ Operation cancelled.".red());
            return Ok(());
        }
    };

    println!(
        "{}",
        format!(
            "\n✅ Resolution: {}x{} | Target Bitrate: {}Mbps\n",
            config.width,
            config.height,
            config.max_bitrate / 1000
        )
        .green()
    );

    println!("{}", "⏳ Initializing native virtual display...".cyan());
    let display = match VirtualDisplay::new(config.width, config.height, "Sunshine Virtual Display")
    {
        Ok(d) => d,
        Err(e) => {
            eprintln!("{}", format!("❌ Error creating monitor: {}", e).red());
            std::process::exit(1);
        }
    };

    println!(
        "{}",
        format!("✅ Monitor initialized natively! (ID: {})", display.id).green()
    );

    println!(
        "{}",
        "⚙️  Optimizing Sunshine via ScreenCaptureKit...".cyan()
    );
    let sunshine_conf_str = generate_sunshine_config(
        display.id,
        config.max_bitrate,
        config.enable_audio,
        config.use_usb_tethering,
    );

    let conf_path = get_sunshine_conf_path();
    if let Err(e) = write_sunshine_config_atomic(&sunshine_conf_str, &conf_path) {
        eprintln!("{}", format!("❌ Error saving configuration: {}", e).red());
        return Ok(());
    }

    // Terminate any previous Sunshine processes
    let _ = Command::new("killall").arg("sunshine").output().await;
    tokio::time::sleep(Duration::from_millis(500)).await;

    println!("{}", "🚀 Starting Sunshine...\n".green());
    let mut sunshine_child = Command::new(&sunshine_bin)
        .arg(&conf_path)
        .stdin(Stdio::inherit())
        .stdout(Stdio::inherit())
        .stderr(Stdio::inherit())
        .spawn()?;

    let cancel_notify = Arc::new(Notify::new());
    let is_shutting_down = Arc::new(AtomicBool::new(false));

    let mut gnirehtet_child = None;

    if config.use_usb_tethering {
        if let Some(ref dev_id) = config.connected_device_id {
            whitelist_gnirehtet_battery(dev_id).await;
        }
        cleanup_stale_gnirehtet(config.connected_device_id.as_deref()).await;

        println!("{}", "🔌 Starting USB tunnel (Gnirehtet)...".cyan());
        match spawn_gnirehtet_tunnel(config.connected_device_id.as_deref(), "10.0.2.2/32") {
            Ok(child) => {
                gnirehtet_child = Some(child);
            }
            Err(e) => {
                eprintln!(
                    "{}",
                    format!("⚠️ Failed to spawn Gnirehtet: {}", e).yellow()
                );
            }
        }

        println!(
            "{}",
            "\n======================================================".cyan()
        );
        println!(
            "{}",
            " ℹ️  USB TUNNEL ACTIVE: Connect Moonlight to IP 10.0.2.2".cyan()
        );
        println!(
            "{}",
            "======================================================\n".cyan()
        );

        // USB Unplug Polling Monitor
        if let Some(expected_id) = config.connected_device_id.clone() {
            let notify_clone = cancel_notify.clone();
            let is_shutting_down_clone = is_shutting_down.clone();
            tokio::spawn(async move {
                let mut interval = tokio::time::interval(Duration::from_secs(3));
                loop {
                    interval.tick().await;
                    if is_shutting_down_clone.load(Ordering::Relaxed) {
                        break;
                    }
                    let current_id = get_adb_device_id().await;
                    if current_id.as_deref() != Some(&expected_id) {
                        println!(
                            "{}",
                            "\n🔌 USB cable disconnected. Closing session...".red()
                        );
                        notify_clone.notify_waiters();
                        break;
                    }
                }
            });
        }
    }

    if config.auto_launch_moonlight {
        if let Some(ref dev_id) = config.connected_device_id {
            println!("{}", "🚀 Launching Moonlight on tablet...".cyan());
            launch_moonlight(dev_id).await;
        }
    }

    // Wait for termination: Ctrl+C, USB disconnect, or Sunshine crash
    tokio::select! {
        _ = tokio::signal::ctrl_c() => {
            // Normal exit requested
        }
        _ = cancel_notify.notified() => {
            // Triggered by USB unplug
        }
        status = sunshine_child.wait() => {
            if let Ok(st) = status {
                println!("{}", format!("\n⚠️  Sunshine terminated with status: {}", st).yellow());
            }
        }
    }

    // Begin graceful teardown
    is_shutting_down.store(true, Ordering::Relaxed);
    println!("{}", "\n=========================================".red());
    println!("{}", " 🧹 Closing processes and cleaning up... ".red());
    println!("{}", "=========================================".red());

    // 1. Close USB Tunnel & Cleanup Android VPN
    if let Some(mut g_child) = gnirehtet_child {
        println!("{}", "-> Closing USB tunnel (Gnirehtet)...".yellow());
        let _ = g_child.kill().await;
    }
    cleanup_stale_gnirehtet(config.connected_device_id.as_deref()).await;

    // 2. Terminate Sunshine Server
    println!("{}", "-> Requesting Sunshine shutdown...".yellow());
    if let Some(pid) = sunshine_child.id() {
        unsafe {
            libc::kill(pid as i32, libc::SIGTERM);
        }
        let _ = tokio::time::timeout(Duration::from_millis(1500), sunshine_child.wait()).await;
        let _ = sunshine_child.kill().await;
    }

    // 3. Destroy Virtual Display
    println!("{}", "-> Destroying native virtual display...".yellow());
    drop(display);

    println!("{}", "✅ Done. Goodbye!".green());
    Ok(())
}
