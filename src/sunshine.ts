export function generateSunshineConfig(
  displayId: string,
  maxBitrate: number,
  enableAudio: boolean,
  useUsbTethering: boolean
): string {
  // Note: min_bitrate is not supported in recent Sunshine versions.
  // Bitrates are defined in Kbps.
  const sunshineConfigLines = [
    `output_name = ${displayId}`,
    `max_bitrate = ${maxBitrate}`,
    // SW encoder fallback: fast preset + zero-latency tune minimize latency when HW encoding is unavailable
    `sw_preset = fast`,
    `sw_tune = zerolatency`,
    `min_log_level = info`
  ];

  if (useUsbTethering) {
    // Disable Forward Error Correction on lossless USB connections to drop latency
    sunshineConfigLines.push('fec_percentage = 0');
  }

  if (!enableAudio) {
    // Setting an invalid audio sink effectively disables audio streaming in Sunshine
    sunshineConfigLines.push('audio_sink = disabled');
  }

  return sunshineConfigLines.join('\n');
}
