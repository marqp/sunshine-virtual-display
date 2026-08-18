use colored::Colorize;
use futures::StreamExt;
use std::process::Stdio;
use tokio::process::{Child, Command};
use tokio_util::codec::{FramedRead, LinesCodec};

pub fn handle_gnirehtet_log(line: &str) {
    let trimmed = line.trim();
    if trimmed.is_empty() {
        return;
    }

    if trimmed.contains("Client #") && trimmed.contains("connected") {
        println!(
            "{}",
            "\n📱 [Gnirehtet] Moonlight client connected over USB tunnel.".green()
        );
    } else if trimmed.contains("Client #") && trimmed.contains("disconnected") {
        println!(
            "{}",
            "\n⚠️  [Gnirehtet] Moonlight client disconnected from USB tunnel.".yellow()
        );
    } else if trimmed.contains("Starting relay server") || trimmed.contains("Relay server started")
    {
        println!(
            "{}",
            "🔌 [Gnirehtet] Relay server active (port 31416).".cyan()
        );
    } else if trimmed.contains("ERROR")
        || trimmed.contains("Exception")
        || trimmed.contains("fail")
        || trimmed.contains("os error")
    {
        eprintln!("{}", format!("❌ [Gnirehtet] {}", trimmed).red());
    } else if trimmed.contains("WARN") {
        eprintln!("{}", format!("⚠️  [Gnirehtet] {}", trimmed).yellow());
    }
}

pub fn spawn_gnirehtet_tunnel(device_id: Option<&str>, routes: &str) -> anyhow::Result<Child> {
    let mut cmd = Command::new("gnirehtet");
    cmd.arg("run");

    if let Some(id) = device_id {
        cmd.arg(id);
    }

    cmd.arg("-r").arg(routes);
    cmd.stdout(Stdio::piped());
    cmd.stderr(Stdio::piped());

    let mut child = cmd.spawn()?;

    if let Some(stdout) = child.stdout.take() {
        tokio::spawn(async move {
            let mut reader = FramedRead::new(stdout, LinesCodec::new());
            while let Some(Ok(line)) = reader.next().await {
                handle_gnirehtet_log(&line);
            }
        });
    }

    if let Some(stderr) = child.stderr.take() {
        tokio::spawn(async move {
            let mut reader = FramedRead::new(stderr, LinesCodec::new());
            while let Some(Ok(line)) = reader.next().await {
                handle_gnirehtet_log(&line);
            }
        });
    }

    Ok(child)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_handle_log_events() {
        handle_gnirehtet_log("2026-08-18 10:00:00.000 INFO Relay: Client #1 connected");
        handle_gnirehtet_log("2026-08-18 10:01:00.000 INFO Relay: Client #1 disconnected");
        handle_gnirehtet_log(
            "2026-08-18 10:00:00.000 ERROR Main: Execution error: Connection reset",
        );
    }
}
