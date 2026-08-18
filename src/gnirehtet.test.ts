import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  attachStreamLineReader,
  handleGnirehtetLog,
  startGnirehtetTunnel,
  stopGnirehtetTunnel,
  whitelistGnirehtetBattery,
  cleanupStaleGnirehtet
} from './gnirehtet.js';
import { spawn, execFile, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import { Readable } from 'stream';

vi.mock('child_process', () => ({
  spawn: vi.fn(),
  execFile: vi.fn()
}));

describe('Gnirehtet Module (src/gnirehtet.ts)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('attachStreamLineReader', () => {
    it('should split chunks into lines and emit them', async () => {
      const stream = new Readable({
        read() {}
      });
      const lines: string[] = [];

      const done = new Promise<void>((resolve) => {
        stream.on('end', () => resolve());
      });

      attachStreamLineReader(stream, (line) => {
        lines.push(line);
      });

      stream.push('Line 1\nLine 2\nLine ');
      stream.push('3\n');
      stream.push(null); // End stream

      await done;

      expect(lines).toEqual(['Line 1', 'Line 2', 'Line 3']);
    });

    it('should handle leftover buffer on stream end', async () => {
      const stream = new Readable({
        read() {}
      });
      const lines: string[] = [];

      const done = new Promise<void>((resolve) => {
        stream.on('end', () => resolve());
      });

      attachStreamLineReader(stream, (line) => {
        lines.push(line);
      });

      stream.push('Final unfinished line');
      stream.push(null);

      await done;

      expect(lines).toEqual(['Final unfinished line']);
    });

    it('should safely do nothing if stream is null', () => {
      expect(() => attachStreamLineReader(null, () => {})).not.toThrow();
    });
  });

  describe('handleGnirehtetLog', () => {
    it('should detect client connection', () => {
      const onClientConnect = vi.fn();
      handleGnirehtetLog('2026-08-18 09:30:00.000 INFO Relay: Client #1 connected', {
        onClientConnect
      });
      expect(onClientConnect).toHaveBeenCalledWith('1');
    });

    it('should detect client disconnection', () => {
      const onClientDisconnect = vi.fn();
      handleGnirehtetLog('2026-08-18 09:31:00.000 INFO Relay: Client #1 disconnected', {
        onClientDisconnect
      });
      expect(onClientDisconnect).toHaveBeenCalledWith('1');
    });

    it('should detect errors and notify onError callback', () => {
      const onError = vi.fn();
      handleGnirehtetLog('2026-08-18 09:31:00.000 ERROR Main: Execution error: Connection reset', {
        onError
      });
      expect(onError).toHaveBeenCalledWith(
        '2026-08-18 09:31:00.000 ERROR Main: Execution error: Connection reset'
      );
    });

    it('should dispatch general info logs to onLog', () => {
      const onLog = vi.fn();
      handleGnirehtetLog(
        '2026-08-18 09:30:00.000 INFO Main: Starting relay server on port 31416...',
        {
          onLog
        }
      );
      expect(onLog).toHaveBeenCalledWith(
        '2026-08-18 09:30:00.000 INFO Main: Starting relay server on port 31416...'
      );
    });
  });

  describe('startGnirehtetTunnel', () => {
    it('should spawn gnirehtet with deviceId and route flags', () => {
      const mockChild = new EventEmitter() as any;
      mockChild.stdout = new EventEmitter();
      mockChild.stderr = new EventEmitter();
      vi.mocked(spawn).mockReturnValue(mockChild);

      const processInstance = startGnirehtetTunnel({
        deviceId: 'DEVICE_XYZ',
        routes: '10.0.2.2/32'
      });

      expect(spawn).toHaveBeenCalledWith('gnirehtet', ['run', 'DEVICE_XYZ', '-r', '10.0.2.2/32'], {
        stdio: ['ignore', 'pipe', 'pipe']
      });
      expect(processInstance).toBe(mockChild);
    });

    it('should forward exit event', () => {
      const mockChild = new EventEmitter() as any;
      mockChild.stdout = new EventEmitter();
      mockChild.stderr = new EventEmitter();
      vi.mocked(spawn).mockReturnValue(mockChild);

      const onExit = vi.fn();
      startGnirehtetTunnel({ onExit });

      mockChild.emit('exit', 42);
      expect(onExit).toHaveBeenCalledWith(42);
    });
  });

  describe('whitelistGnirehtetBattery', () => {
    it('should execute adb deviceidle whitelist command', async () => {
      vi.mocked(execFile).mockImplementation(((file: string, args: string[], cb: any) => {
        cb(null, { stdout: 'Added' });
      }) as any);

      await whitelistGnirehtetBattery('DEV_123');
      expect(execFile).toHaveBeenCalledWith(
        'adb',
        [
          '-s',
          'DEV_123',
          'shell',
          'dumpsys',
          'deviceidle',
          'whitelist',
          '+com.genymobile.gnirehtet'
        ],
        expect.any(Function)
      );
    });
  });

  describe('cleanupStaleGnirehtet and stopGnirehtetTunnel', () => {
    it('should stop Android app via adb and kill host process on stopGnirehtetTunnel', async () => {
      vi.mocked(execFile).mockImplementation(((file: string, args: string[], cb: any) => {
        cb(null, { stdout: '' });
      }) as any);

      const mockChild = new EventEmitter() as any;
      mockChild.kill = vi.fn();
      mockChild.killed = false;

      await stopGnirehtetTunnel(mockChild as unknown as ChildProcess, 'DEV_123');

      expect(mockChild.kill).toHaveBeenCalledWith('SIGINT');
      expect(execFile).toHaveBeenCalledWith(
        'adb',
        ['-s', 'DEV_123', 'shell', 'am', 'force-stop', 'com.genymobile.gnirehtet'],
        expect.any(Function)
      );
    });

    it('should clear processes listening on port 31416', async () => {
      const processKillSpy = vi.spyOn(process, 'kill').mockImplementation((() => true) as any);

      vi.mocked(execFile).mockImplementation(((file: string, args: string[], cb: any) => {
        if (file === 'lsof') {
          cb(null, { stdout: '12345\n67890\n' });
        } else {
          cb(null, { stdout: '' });
        }
      }) as any);

      await cleanupStaleGnirehtet();

      expect(processKillSpy).toHaveBeenCalledWith(12345, 'SIGKILL');
      expect(processKillSpy).toHaveBeenCalledWith(67890, 'SIGKILL');
    });
  });
});
