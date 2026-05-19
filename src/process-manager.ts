import { ChildProcess } from 'child_process';
import { green, red, yellow } from 'kleur/colors';

/**
 * ProcessManager encapsulates the lifecycle and cleanup of child processes
 * and hardware monitoring intervals. It handles OS signals (SIGINT, SIGTERM)
 * to ensure a graceful teardown of all resources.
 */
export class ProcessManager {
  private displayDaemon: ChildProcess | null = null;
  private sunshineProcess: ChildProcess | null = null;
  private gnirehtetProcess: ChildProcess | null = null;
  private usbMonitorInterval: NodeJS.Timeout | null = null;
  private isShuttingDown = false;

  constructor() {
    // Self-register lifecycle listeners
    process.on('SIGINT', () => this.teardown());
    process.on('SIGTERM', () => this.teardown());
  }

  /**
   * Registers the background display daemon process.
   */
  public registerDisplay(child: ChildProcess): void {
    this.displayDaemon = child;
  }

  /**
   * Registers the Sunshine streaming server process.
   */
  public registerSunshine(child: ChildProcess): void {
    this.sunshineProcess = child;

    // If Sunshine server exits on its own (crash), trigger general cleanup
    child.on('exit', () => {
      if (!this.isShuttingDown) {
        console.log(yellow('\n⚠️  Sunshine has been terminated.'));
        this.teardown();
      }
    });
  }

  /**
   * Registers the USB tunnel (Gnirehtet) process.
   */
  public registerGnirehtet(child: ChildProcess): void {
    this.gnirehtetProcess = child;
  }

  /**
   * Sets the interval used for USB hardware monitoring.
   */
  public setUsbMonitor(interval: NodeJS.Timeout): void {
    this.usbMonitorInterval = interval;
  }

  /**
   * Gracefully shuts down all managed processes and clears monitors.
   */
  public teardown(): void {
    if (this.isShuttingDown) return;
    this.isShuttingDown = true;

    if (this.usbMonitorInterval) {
      clearInterval(this.usbMonitorInterval);
    }

    console.log(red('\n========================================='));
    console.log(red(' 🧹 Closing processes and cleaning up... '));
    console.log(red('========================================='));

    // 1. Close USB Tunnel
    if (this.gnirehtetProcess && !this.gnirehtetProcess.killed) {
      console.log(yellow('-> Closing USB tunnel (Gnirehtet)...'));
      this.gnirehtetProcess.kill('SIGINT');
    }

    // 2. Close Sunshine Server
    if (this.sunshineProcess && !this.sunshineProcess.killed) {
      console.log(yellow('-> Requesting Sunshine shutdown...'));
      this.sunshineProcess.kill('SIGTERM');

      // Fallback to aggressive SIGKILL if Sunshine hangs longer than 2s
      const sunshine = this.sunshineProcess;
      setTimeout(() => {
        if (!sunshine.killed) sunshine.kill('SIGKILL');
      }, 2000);
    }

    // 3. Close Display Daemon
    if (this.displayDaemon && !this.displayDaemon.killed) {
      console.log(yellow('-> Destroying native virtual display...'));
      this.displayDaemon.kill('SIGINT');
    }

    // Give a small delay for processes to die gracefully in the OS
    setTimeout(() => {
      console.log(green('✅ Done. Goodbye!'));
      process.exit(0);
    }, 500);
  }
}
