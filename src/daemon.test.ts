import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runDaemon } from './daemon.js';

// Mock node-mac-virtual-display with a proper constructor function
const mockCreateVirtualDisplay = vi.fn();
const mockDestroyVirtualDisplay = vi.fn();
vi.mock('node-mac-virtual-display', () => ({
  default: function MockVirtualDisplay() {
    this.createVirtualDisplay = mockCreateVirtualDisplay;
    this.destroyVirtualDisplay = mockDestroyVirtualDisplay;
  }
}));

describe('Daemon (src/daemon.ts)', () => {
  let originalArgv: string[];
  let originalSend: typeof process.send;
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    originalArgv = process.argv;
    originalSend = process.send as typeof process.send;
    process.send = vi.fn();
    // Prevent actual process.exit
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as any);
    process.argv = ['node', 'index.js', '--daemon-mode', '1920', '1080', 'Test Display'];
  });

  afterEach(() => {
    process.argv = originalArgv;
    process.send = originalSend;
    exitSpy.mockRestore();
    vi.useRealTimers();
  });

  it('should create a virtual display with the specified parameters', () => {
    mockCreateVirtualDisplay.mockReturnValue({ id: 42 });
    runDaemon();

    expect(mockCreateVirtualDisplay).toHaveBeenCalledWith({
      width: 1920,
      height: 1080,
      frameRate: 60,
      hiDPI: true,
      displayName: 'Test Display',
      mirror: false
    });
  });

  it('should send SUCCESS message with display ID via IPC', () => {
    mockCreateVirtualDisplay.mockReturnValue({ id: 42 });
    runDaemon();

    expect(process.send).toHaveBeenCalledWith({ type: 'SUCCESS', id: 42 });
  });

  it('should send SUCCESS with "Unknown" if display ID is falsy', () => {
    mockCreateVirtualDisplay.mockReturnValue({ id: null });
    runDaemon();

    expect(process.send).toHaveBeenCalledWith({ type: 'SUCCESS', id: 'Unknown' });
  });

  it('should fall back to stdout if process.send is not available', () => {
    process.send = undefined as any;
    mockCreateVirtualDisplay.mockReturnValue({ id: 99 });
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    runDaemon();

    expect(logSpy).toHaveBeenCalledWith('Virtual display created with ID: 99');
    logSpy.mockRestore();
  });

  it('should send ERROR message and exit with code 1 on failure', () => {
    mockCreateVirtualDisplay.mockImplementation(() => {
      throw new Error('GPU unavailable');
    });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    runDaemon();

    expect(process.send).toHaveBeenCalledWith({ type: 'ERROR', message: 'GPU unavailable' });
    expect(exitSpy).toHaveBeenCalledWith(1);
    errorSpy.mockRestore();
  });

  it('should extract displayId from result object using fallback keys', () => {
    // Test displayID (capital D) fallback
    mockCreateVirtualDisplay.mockReturnValue({ displayID: 'abc-123' });
    runDaemon();

    expect(process.send).toHaveBeenCalledWith({ type: 'SUCCESS', id: 'abc-123' });
  });

  it('should use default display name when not provided', () => {
    process.argv = ['node', 'index.js', '--daemon-mode', '1920', '1080'];
    mockCreateVirtualDisplay.mockReturnValue({ id: 1 });
    runDaemon();

    expect(mockCreateVirtualDisplay).toHaveBeenCalledWith(
      expect.objectContaining({ displayName: 'Sunshine Virtual Display' })
    );
  });
});
