import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ProcessManager } from './process-manager.js';
import { ChildProcess } from 'child_process';
import { EventEmitter } from 'events';

describe('ProcessManager (src/process-manager.ts)', () => {
  let pm: ProcessManager;
  let mockProcess: any;

  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();
    // Mock process.exit
    vi.spyOn(process, 'exit').mockImplementation((() => {}) as any);
    
    pm = new ProcessManager();
    
    // Create a mock ChildProcess
    mockProcess = new EventEmitter();
    mockProcess.kill = vi.fn();
    mockProcess.killed = false;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should register and kill display daemon on teardown', () => {
    pm.registerDisplay(mockProcess as unknown as ChildProcess);
    pm.teardown();

    expect(mockProcess.kill).toHaveBeenCalledWith('SIGINT');
  });

  it('should register and kill gnirehtet on teardown', () => {
    pm.registerGnirehtet(mockProcess as unknown as ChildProcess);
    pm.teardown();

    expect(mockProcess.kill).toHaveBeenCalledWith('SIGINT');
  });

  it('should register and kill sunshine with SIGTERM on teardown', () => {
    pm.registerSunshine(mockProcess as unknown as ChildProcess);
    pm.teardown();

    expect(mockProcess.kill).toHaveBeenCalledWith('SIGTERM');
  });

  it('should fallback to SIGKILL for sunshine if not killed after timeout', () => {
    pm.registerSunshine(mockProcess as unknown as ChildProcess);
    pm.teardown();

    // Fast-forward 2 seconds
    vi.advanceTimersByTime(2100);

    expect(mockProcess.kill).toHaveBeenCalledWith('SIGKILL');
  });

  it('should register OS signal listeners on instantiation', () => {
    const onSpy = vi.spyOn(process, 'on');
    new ProcessManager();
    
    expect(onSpy).toHaveBeenCalledWith('SIGINT', expect.any(Function));
    expect(onSpy).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
  });

  it('should trigger teardown when sunshine process exits unexpectedly', () => {
    const teardownSpy = vi.spyOn(pm, 'teardown');
    pm.registerSunshine(mockProcess as unknown as ChildProcess);
    
    mockProcess.emit('exit');
    
    expect(teardownSpy).toHaveBeenCalled();
  });
});
