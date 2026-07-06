import { describe, it, expect } from 'vitest';
import { generateSunshineConfig } from './sunshine.js';

describe('generateSunshineConfig', () => {
  it('should generate a correct configuration string when audio is enabled', () => {
    const displayId = '12345';
    const maxBitrate = 30000;
    const enableAudio = true;
    const useUsbTethering = false;

    const config = generateSunshineConfig(displayId, maxBitrate, enableAudio, useUsbTethering);

    expect(config).toContain(`output_name = ${displayId}`);
    expect(config).toContain(`max_bitrate = ${maxBitrate}`);
    expect(config).toContain('sw_preset = fast');
    expect(config).toContain('sw_tune = zerolatency');
    expect(config).not.toContain('fec_percentage = 0');
    expect(config).not.toContain('audio_sink = disabled');
  });

  it('should generate a correct configuration string when audio is disabled and USB tethering is active', () => {
    const displayId = '67890';
    const maxBitrate = 60000;
    const enableAudio = false;
    const useUsbTethering = true;

    const config = generateSunshineConfig(displayId, maxBitrate, enableAudio, useUsbTethering);

    expect(config).toContain(`output_name = ${displayId}`);
    expect(config).toContain(`max_bitrate = ${maxBitrate}`);
    expect(config).toContain('sw_preset = fast');
    expect(config).toContain('sw_tune = zerolatency');
    expect(config).toContain('fec_percentage = 0');
    expect(config).toContain('audio_sink = disabled');
  });
});
