import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { findSunshineBin, getAdbDeviceId, hasGnirehtet } from './utils.js';
import { exec } from 'child_process';
import { access } from 'fs/promises';

// Mock child_process
vi.mock('child_process', () => ({
  exec: vi.fn()
}));

// Mock fs/promises
vi.mock('fs/promises', () => ({
  access: vi.fn()
}));

describe('System Utilities (src/utils.ts)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.SUNSHINE_BIN_PATH;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('findSunshineBin', () => {
    it('should return SUNSHINE_BIN_PATH if environment variable is set', async () => {
      process.env.SUNSHINE_BIN_PATH = '/custom/path/sunshine';
      const bin = await findSunshineBin();
      expect(bin).toBe('/custom/path/sunshine');

      // Ensure it doesn't try to call 'which' if env var is set
      expect(exec).not.toHaveBeenCalled();
    });

    it('should return path from "which" if available', async () => {
      // @ts-expect-error - exec mock implementation
      vi.mocked(exec).mockImplementation((cmd, cb) => cb(null, { stdout: '/usr/bin/sunshine' }));

      const bin = await findSunshineBin();
      expect(bin).toBe('/usr/bin/sunshine');
    });

    it('should fall back to common paths if "which" fails', async () => {
      // @ts-expect-error - exec mock implementation
      vi.mocked(exec).mockImplementation((cmd, cb) => cb(new Error('not found')));

      // Mock second path in commonPaths to succeed
      // commonPaths[0] = /opt/homebrew/bin/sunshine
      // commonPaths[1] = /usr/local/bin/sunshine
      vi.mocked(access).mockRejectedValueOnce(new Error('no')).mockResolvedValueOnce(undefined);

      const bin = await findSunshineBin();
      expect(bin).toBe('/usr/local/bin/sunshine');
      expect(access).toHaveBeenCalledTimes(2);
    });

    it('should throw error if no binary is found anywhere', async () => {
      // @ts-expect-error - exec mock implementation
      vi.mocked(exec).mockImplementation((cmd, cb) => cb(new Error('not found')));
      vi.mocked(access).mockRejectedValue(new Error('no'));

      await expect(findSunshineBin()).rejects.toThrow('Sunshine not found');
    });
  });

  describe('getAdbDeviceId', () => {
    it('should return device ID when an authorized device is connected', async () => {
      const mockOutput = 'List of devices attached\nABC123\tdevice\n';
      // @ts-expect-error - exec mock implementation
      vi.mocked(exec).mockImplementation((cmd, cb) => cb(null, { stdout: mockOutput }));

      const deviceId = await getAdbDeviceId();
      expect(deviceId).toBe('ABC123');
    });

    it('should return null when no device is connected', async () => {
      const mockOutput = 'List of devices attached\n';
      // @ts-expect-error - exec mock implementation
      vi.mocked(exec).mockImplementation((cmd, cb) => cb(null, { stdout: mockOutput }));

      const deviceId = await getAdbDeviceId();
      expect(deviceId).toBeNull();
    });

    it('should return null if adb command fails', async () => {
      // @ts-expect-error - exec mock implementation
      vi.mocked(exec).mockImplementation((cmd, cb) => cb(new Error('ADB not found')));

      const deviceId = await getAdbDeviceId();
      expect(deviceId).toBeNull();
    });
  });

  describe('hasGnirehtet', () => {
    it('should return true if gnirehtet is installed', async () => {
      // @ts-expect-error - exec mock implementation
      vi.mocked(exec).mockImplementation((cmd, cb) =>
        cb(null, { stdout: '/usr/local/bin/gnirehtet' })
      );

      const result = await hasGnirehtet();
      expect(result).toBe(true);
    });

    it('should return false if gnirehtet is missing', async () => {
      // @ts-expect-error - exec mock implementation
      vi.mocked(exec).mockImplementation((cmd, cb) => cb(new Error('command not found')));

      const result = await hasGnirehtet();
      expect(result).toBe(false);
    });
  });
});
