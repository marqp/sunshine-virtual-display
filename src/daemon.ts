import VirtualDisplay from 'node-mac-virtual-display';

/**
 * runDaemon encapsulates the logic for creating and managing the native macOS
 * virtual display. It is designed to be executed as a sub-process of the main
 * CLI tool, either as a script or as a special mode of the compiled binary.
 */
export function runDaemon(): void {
  // Arguments passed via spawn:
  // [0] = process.execPath (the binary or node)
  // [1] = index.ts or --daemon-mode
  // We look for the index of '--daemon-mode' to find our parameters reliably
  const daemonFlagIndex = process.argv.indexOf('--daemon-mode');

  const width = parseInt(process.argv[daemonFlagIndex + 1], 10);
  const height = parseInt(process.argv[daemonFlagIndex + 2], 10);
  const displayName = process.argv[daemonFlagIndex + 3] || 'Sunshine Virtual Display';

  const vdisplay = new VirtualDisplay();

  try {
    // Instantiate the virtual screen in macOS and capture the returned ID/info
    const displayResult = vdisplay.createVirtualDisplay({
      width: width,
      height: height,
      frameRate: 60,
      hiDPI: true,
      displayName: displayName,
      mirror: false
    });

    /**
     * node-mac-virtual-display returns a Display Object.
     * We need to extract the numerical/string ID for Sunshine targeting.
     */
    const displayId =
      displayResult && typeof displayResult === 'object'
        ? (displayResult as any).id ||
          (displayResult as any).displayId ||
          (displayResult as any).displayID
        : displayResult;

    // Emit success cleanly via IPC channel
    if (process.send) {
      process.send({ type: 'SUCCESS', id: displayId || 'Unknown' });
    } else {
      // Fallback to stdout if run manually
      console.log(`Virtual display created with ID: ${displayId}`);
    }

    // Keep alive: Keeps the Event Loop running so the process doesn't close immediately
    setInterval(() => {}, 1000);

    // Cleanup function that destroys the virtual display in the OS
    const cleanup = () => {
      try {
        vdisplay.destroyVirtualDisplay();
      } catch {
        // Ignore errors during destruction (it might already be dead)
      }
      process.exit(0);
    };

    // Parent Death Detection: If the main (parent) process dies or crashes,
    // the IPC channel disconnects, triggering the destruction of the zombie monitor.
    process.on('disconnect', () => {
      cleanup();
    });

    // Listen for termination signals sent by the OS or parent process
    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
  } catch (err: any) {
    // Report error to parent process via IPC (if available)
    if (process.send) process.send({ type: 'ERROR', message: err.message });
    console.error('FATAL:', err);
    process.exit(1);
  }
}
