import { describe, it, expect, vi, beforeEach } from 'vitest';
import { writeSunshineConfigAtomic } from './io.js';
import fs from 'fs';
import path from 'path';

vi.mock('fs');
vi.mock('path');

describe('Atomic I/O (src/io.ts)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should create directory if it does not exist', () => {
    vi.mocked(path.dirname).mockReturnValue('/mock/config');
    vi.mocked(fs.existsSync).mockReturnValue(false); // Dir doesn't exist
    vi.mocked(fs.mkdirSync).mockImplementation(() => undefined);

    // Mock write and rename to succeed
    vi.mocked(fs.writeFileSync).mockImplementation(() => undefined);
    vi.mocked(fs.renameSync).mockImplementation(() => undefined);

    writeSunshineConfigAtomic('test content', '/mock/config/sunshine.conf');

    expect(fs.mkdirSync).toHaveBeenCalledWith('/mock/config', { recursive: true });
  });

  it('should not create directory if it already exists', () => {
    vi.mocked(path.dirname).mockReturnValue('/mock/config');
    vi.mocked(fs.existsSync).mockReturnValue(true); // Dir exists

    writeSunshineConfigAtomic('test content', '/mock/config/sunshine.conf');

    expect(fs.mkdirSync).not.toHaveBeenCalled();
  });

  it('should perform atomic write flow (write to temp then rename)', () => {
    vi.mocked(path.dirname).mockReturnValue('/mock/config');
    vi.mocked(fs.existsSync).mockReturnValue(true);

    writeSunshineConfigAtomic('content', '/mock/config/sunshine.conf');

    expect(fs.writeFileSync).toHaveBeenCalledWith(
      expect.stringContaining('/mock/config/sunshine.conf.tmp.'),
      'content',
      expect.objectContaining({ mode: 0o600 })
    );
    expect(fs.renameSync).toHaveBeenCalled();
  });

  it('should throw error if write fails', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.writeFileSync).mockImplementation(() => {
      throw new Error('EACCES');
    });

    expect(() => writeSunshineConfigAtomic('content', 'path')).toThrow('Permission denied');
  });

  it('should clean up temp file and throw error if rename fails', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    // writeFileSync succeeds
    vi.mocked(fs.writeFileSync).mockImplementation(() => undefined);
    // renameSync fails
    vi.mocked(fs.renameSync).mockImplementation(() => {
      throw new Error('EXDEV');
    });
    // Mock exists for cleanup check (unlinkSync)
    vi.mocked(fs.existsSync).mockReturnValue(true);

    expect(() => writeSunshineConfigAtomic('content', 'path')).toThrow('Atomic rename failed');
    expect(fs.unlinkSync).toHaveBeenCalled();
  });
});
