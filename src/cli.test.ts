import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runInteractiveMenu } from './cli.js';
import prompts from 'prompts';
import * as utils from './utils.js';

// Mock prompts
vi.mock('prompts', () => ({
  default: vi.fn()
}));

// Mock utils
vi.mock('./utils.js', () => ({
  getAdbDeviceId: vi.fn(),
  hasGnirehtet: vi.fn()
}));

describe('CLI Interface (src/cli.ts)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('CI Mode', () => {
    it('should automatically select Balanced profile when no USB device is found', async () => {
      vi.mocked(utils.getAdbDeviceId).mockResolvedValue(null);
      vi.mocked(utils.hasGnirehtet).mockResolvedValue(true);

      const config = await runInteractiveMenu(true);

      expect(config).toMatchObject({
        isCiMode: true,
        useUsbTethering: false,
        q: { maxBit: 30000 }
      });
    });

    it('should automatically select Cinematic profile when USB device is detected', async () => {
      vi.mocked(utils.getAdbDeviceId).mockResolvedValue('DEVICE123');
      vi.mocked(utils.hasGnirehtet).mockResolvedValue(true);

      const config = await runInteractiveMenu(true);

      expect(config).toMatchObject({
        isCiMode: true,
        useUsbTethering: true,
        connectedDeviceId: 'DEVICE123',
        q: { maxBit: 60000 }
      });
    });
  });

  describe('Interactive Mode', () => {
    it('should return full config based on user prompts', async () => {
      vi.mocked(utils.getAdbDeviceId).mockResolvedValue(null);
      vi.mocked(utils.hasGnirehtet).mockResolvedValue(true);

      // Simulate user selecting Balanced (index 1) and enabling audio
      vi.mocked(prompts)
        .mockResolvedValueOnce({ quality: { maxBit: 30000, sw: 'fast' } }) // Quality
        .mockResolvedValueOnce({ enableAudio: true }); // Audio

      const config = await runInteractiveMenu(false);

      expect(config).toMatchObject({
        isCiMode: false,
        useUsbTethering: false,
        enableAudio: true,
        q: { maxBit: 30000 }
      });
    });

    it('should prompt for USB tethering if device is detected', async () => {
      vi.mocked(utils.getAdbDeviceId).mockResolvedValue('DEVICE123');
      vi.mocked(utils.hasGnirehtet).mockResolvedValue(true);

      // Simulate user accepting USB tethering, selecting quality, and disabling audio
      vi.mocked(prompts)
        .mockResolvedValueOnce({ useUsbTethering: true })
        .mockResolvedValueOnce({ quality: { maxBit: 15000, sw: 'fast' } })
        .mockResolvedValueOnce({ enableAudio: false });

      const config = await runInteractiveMenu(false);

      expect(config).toMatchObject({
        useUsbTethering: true,
        connectedDeviceId: 'DEVICE123',
        q: { maxBit: 15000 }
      });
    });

    it('should return null if user cancels quality selection', async () => {
      vi.mocked(utils.getAdbDeviceId).mockResolvedValue(null);
      vi.mocked(prompts).mockResolvedValueOnce({}); // Empty response simulates ESC/Ctrl+C

      const config = await runInteractiveMenu(false);
      expect(config).toBeNull();
    });

    it('should return null if user cancels audio selection', async () => {
      vi.mocked(utils.getAdbDeviceId).mockResolvedValue(null);
      vi.mocked(prompts)
        .mockResolvedValueOnce({ quality: { maxBit: 30000 } })
        .mockResolvedValueOnce({}); // Cancel audio

      const config = await runInteractiveMenu(false);
      expect(config).toBeNull();
    });
  });
});
