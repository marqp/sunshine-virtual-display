use std::path::PathBuf;
use tokio::process::Command;

pub async fn find_sunshine_bin() -> anyhow::Result<PathBuf> {
    if let Ok(custom_path) = std::env::var("SUNSHINE_BIN_PATH") {
        let p = PathBuf::from(custom_path);
        if p.exists() {
            return Ok(p);
        }
        anyhow::bail!("SUNSHINE_BIN_PATH is set but does not exist");
    }

    if let Ok(p) = which::which("sunshine") {
        return Ok(p);
    }

    let common_paths = [
        "/opt/homebrew/bin/sunshine",
        "/usr/local/bin/sunshine",
        "/Applications/Sunshine.app/Contents/MacOS/sunshine",
        "/opt/homebrew/opt/sunshine/bin/sunshine",
    ];

    for path_str in &common_paths {
        let p = PathBuf::from(path_str);
        if p.exists() {
            return Ok(p);
        }
    }

    anyhow::bail!("Sunshine binary not found. Make sure Sunshine is installed or in $PATH.")
}

pub async fn get_adb_device_id() -> Option<String> {
    let output = Command::new("adb").arg("devices").output().await.ok()?;

    if !output.status.success() {
        return None;
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    for line in stdout.lines() {
        if line.contains("\tdevice") {
            if let Some(id) = line.split('\t').next() {
                let trimmed = id.trim();
                if !trimmed.is_empty() {
                    return Some(trimmed.to_string());
                }
            }
        }
    }

    None
}

pub async fn has_gnirehtet() -> bool {
    which::which("gnirehtet").is_ok()
}

pub async fn is_moonlight_installed(device_id: &str) -> bool {
    let output = Command::new("adb")
        .args(&[
            "-s",
            device_id,
            "shell",
            "pm",
            "list",
            "packages",
            "com.limelight",
        ])
        .output()
        .await;

    match output {
        Ok(out) => {
            let stdout = String::from_utf8_lossy(&out.stdout);
            stdout.contains("package:com.limelight")
        }
        Err(_) => false,
    }
}

pub async fn launch_moonlight(device_id: &str) {
    let _ = Command::new("adb")
        .args(&[
            "-s",
            device_id,
            "shell",
            "monkey",
            "-p",
            "com.limelight",
            "-c",
            "android.intent.category.LAUNCHER",
            "1",
        ])
        .output()
        .await;
}

pub async fn whitelist_gnirehtet_battery(device_id: &str) {
    let _ = Command::new("adb")
        .args(&[
            "-s",
            device_id,
            "shell",
            "dumpsys",
            "deviceidle",
            "whitelist",
            "+com.genymobile.gnirehtet",
        ])
        .output()
        .await;
}

pub async fn cleanup_stale_gnirehtet(device_id: Option<&str>) {
    if let Some(id) = device_id {
        let _ = Command::new("adb")
            .args(&[
                "-s",
                id,
                "shell",
                "am",
                "force-stop",
                "com.genymobile.gnirehtet",
            ])
            .output()
            .await;
    }

    if let Ok(output) = Command::new("lsof").arg("-ti:31416").output().await {
        let pids_str = String::from_utf8_lossy(&output.stdout);
        for line in pids_str.lines() {
            if let Ok(pid) = line.trim().parse::<i32>() {
                unsafe {
                    libc::kill(pid, libc::SIGKILL);
                }
            }
        }
    }
}
