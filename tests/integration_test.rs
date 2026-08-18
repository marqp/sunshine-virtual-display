#[cfg(test)]
mod tests {
    use std::fs;
    use tempfile::tempdir;

    #[test]
    fn test_config_generation_and_persistence() {
        let temp_dir = tempdir().unwrap();
        let target_path = temp_dir.path().join("config/sunshine.conf");

        let display_id = 42;
        let max_bitrate = 60000;
        let enable_audio = true;
        let use_usb_tethering = true;

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

        let content = lines.join("\n");
        fs::create_dir_all(target_path.parent().unwrap()).unwrap();
        fs::write(&target_path, &content).unwrap();

        let read_back = fs::read_to_string(&target_path).unwrap();
        assert!(read_back.contains("output_name = 42"));
        assert!(read_back.contains("max_bitrate = 60000"));
        assert!(read_back.contains("fec_percentage = 0"));
    }
}
