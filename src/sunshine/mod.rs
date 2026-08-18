use anyhow::Context;
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use tempfile::NamedTempFile;

pub fn get_sunshine_conf_path() -> PathBuf {
    let home = std::env::var("HOME").unwrap_or_else(|_| ".".to_string());
    PathBuf::from(home).join(".config/sunshine/sunshine.conf")
}

pub fn generate_sunshine_config(
    display_id: u32,
    max_bitrate: u32,
    enable_audio: bool,
    use_usb_tethering: bool,
) -> String {
    let mut lines = vec![
        format!("output_name = {}", display_id),
        format!("max_bitrate = {}", max_bitrate),
        "sw_preset = fast".to_string(),
        "sw_tune = zerolatency".to_string(),
        "min_log_level = info".to_string(),
    ];

    if use_usb_tethering {
        lines.push("fec_percentage = 0".to_string());
    }

    if !enable_audio {
        lines.push("audio_sink = disabled".to_string());
    }

    lines.join("\n")
}

pub fn write_sunshine_config_atomic(
    config_content: &str,
    target_path: &Path,
) -> anyhow::Result<()> {
    if let Some(parent) = target_path.parent() {
        fs::create_dir_all(parent)
            .with_context(|| format!("Failed to create directory {:?}", parent))?;
    }

    let parent_dir = target_path.parent().unwrap_or_else(|| Path::new("."));
    let mut temp_file = NamedTempFile::new_in(parent_dir)
        .with_context(|| "Failed to create temporary config file")?;

    temp_file
        .write_all(config_content.as_bytes())
        .with_context(|| "Failed to write configuration to temporary file")?;
    temp_file
        .flush()
        .with_context(|| "Failed to flush temporary file")?;

    temp_file.persist(target_path).with_context(|| {
        format!(
            "Failed to atomically persist configuration to {:?}",
            target_path
        )
    })?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_sunshine_config() {
        let conf = generate_sunshine_config(12, 60000, true, true);
        assert!(conf.contains("output_name = 12"));
        assert!(conf.contains("max_bitrate = 60000"));
        assert!(conf.contains("fec_percentage = 0"));
        assert!(!conf.contains("audio_sink = disabled"));

        let conf_no_usb = generate_sunshine_config(5, 30000, false, false);
        assert!(conf_no_usb.contains("output_name = 5"));
        assert!(conf_no_usb.contains("audio_sink = disabled"));
        assert!(!conf_no_usb.contains("fec_percentage = 0"));
    }

    #[test]
    fn test_write_atomic() {
        let temp_dir = tempfile::tempdir().unwrap();
        let target = temp_dir.path().join("sub/sunshine.conf");
        let content = "output_name = 99\nmax_bitrate = 30000";

        write_sunshine_config_atomic(content, &target).unwrap();
        let read_back = fs::read_to_string(&target).unwrap();
        assert_eq!(read_back, content);
    }
}
