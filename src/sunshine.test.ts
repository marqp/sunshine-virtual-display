import { describe, it, expect } from 'vitest';
import { generateSunshineConfig } from './sunshine.js';

describe('generateSunshineConfig', () => {
  it('should generate a correct configuration string when audio is enabled', () => {
    const displayId = '12345';
    const maxBitrate = 30000;
    const swPreset = 'fast';
    const enableAudio = true;

    const config = generateSunshineConfig(displayId, maxBitrate, swPreset, enableAudio);

    expect(config).toContain(`output_name = ${displayId}`);
    expect(config).toContain(`max_bitrate = ${maxBitrate}`);
    expect(config).toContain(`sw_preset = ${swPreset}`);
    expect(config).not.toContain('audio_sink = disabled');
  });

  it('should generate a correct configuration string when audio is disabled', () => {
    const displayId = '67890';
    const maxBitrate = 60000;
    const swPreset = 'medium';
    const enableAudio = false;

    const config = generateSunshineConfig(displayId, maxBitrate, swPreset, enableAudio);

    expect(config).toContain(`output_name = ${displayId}`);
    expect(config).toContain(`max_bitrate = ${maxBitrate}`);
    expect(config).toContain(`sw_preset = ${swPreset}`);
    expect(config).toContain('audio_sink = disabled');
  });
});
