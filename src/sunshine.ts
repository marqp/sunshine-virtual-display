export function generateSunshineConfig(
  displayId: string,
  maxBitrate: number,
  swPreset: string,
  enableAudio: boolean
): string {
  // Note: min_bitrate is not supported in recent Sunshine versions.
  // Bitrates are defined in Kbps.
  const sunshineConfigLines = [
    `output_name = ${displayId}`,
    `max_bitrate = ${maxBitrate}`,
    `sw_preset = ${swPreset}`,
    `sw_tune = zerolatency`,
    `min_log_level = info`
  ];

  if (!enableAudio) {
    // Setting an invalid audio sink effectively disables audio streaming in Sunshine
    sunshineConfigLines.push('audio_sink = disabled');
  }

  return sunshineConfigLines.join('\n');
}
