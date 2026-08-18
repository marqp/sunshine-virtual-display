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

pub fn parse_wm_size_output(stdout: &str) -> Option<(u32, u32)> {
    // Searches for "Override size:" first, then falls back to "Physical size:"
    let mut chosen_size = None;
    for line in stdout.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with("Override size:") {
            chosen_size = trimmed.split(':').nth(1);
            break;
        } else if trimmed.starts_with("Physical size:") {
            chosen_size = trimmed.split(':').nth(1);
        }
    }

    if let Some(dims) = chosen_size {
        let parts: Vec<&str> = dims.trim().split('x').collect();
        if parts.len() == 2 {
            if let (Ok(d1), Ok(d2)) = (parts[0].parse::<u32>(), parts[1].parse::<u32>()) {
                if d1 > 0 && d2 > 0 {
                    // Return landscape orientation (width = max, height = min)
                    return Some((d1.max(d2), d1.min(d2)));
                }
            }
        }
    }

    None
}

pub async fn get_device_screen_size(device_id: Option<&str>) -> Option<(u32, u32)> {
    let mut cmd = Command::new("adb");
    if let Some(id) = device_id {
        cmd.args(&["-s", id]);
    }
    cmd.args(&["shell", "wm", "size"]);
    let output = cmd.output().await.ok()?;
    if !output.status.success() {
        return None;
    }
    let stdout = String::from_utf8_lossy(&output.stdout);
    parse_wm_size_output(&stdout)
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_wm_size_physical() {
        let stdout = "Physical size: 1800x2880\n";
        assert_eq!(parse_wm_size_output(stdout), Some((2880, 1800)));
    }

    #[test]
    fn test_parse_wm_size_override() {
        let stdout = "Physical size: 1800x2880\nOverride size: 1200x1920\n";
        assert_eq!(parse_wm_size_output(stdout), Some((1920, 1200)));
    }

    #[test]
    fn test_parse_wm_size_invalid() {
        assert_eq!(parse_wm_size_output(""), None);
        assert_eq!(parse_wm_size_output("Error running wm\n"), None);
    }
}
