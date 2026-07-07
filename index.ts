import { spawn, fork, execSync } from 'child_process';
import os from 'os';
import path from 'path';
import { green, red, yellow, cyan } from 'kleur/colors';

import { findSunshineBin, getAdbDeviceId, launchMoonlight } from './src/utils.js';
import { runInteractiveMenu } from './src/cli.js';
import { generateSunshineConfig } from './src/sunshine.js';
import { writeSunshineConfigAtomic } from './src/io.js';
import { ProcessManager } from './src/process-manager.js';
import { runDaemon } from './src/daemon.js';

/**
 * Compatibility for hybrid environments (Node.js/Bun) and ES modules (ESM).
 * Resolves current filename without relying on import.meta in bundled CJS.
 */
const SUNSHINE_CONF = path.join(os.homedir(), '.config/sunshine/sunshine.conf');

/**
 * Entry point logic.
 * If the --daemon-mode flag is present, it runs the virtual display logic.
 * Otherwise, it runs the main CLI orchestrator.
 */
if (process.argv.includes('--daemon-mode')) {
  runDaemon();
} else {
  main().catch((err) => {
    console.error(red('Unhandled error:'), err);
    process.exit(1);
  });
}

async function main() {
  console.clear();
  console.log(cyan('========================================='));
  console.log(cyan(' ☀️ Sunshine Native Auto-Provision (TS) ☀️ '));
  console.log(cyan('=========================================\n'));

  // Initialize the ProcessManager to handle lifecycle and signals (SIGINT/SIGTERM)
  const pm = new ProcessManager();

  const SUNSHINE_BIN = await findSunshineBin();

  // We fix the resolution at 1080p. Fine-tuning is done via macOS System Settings
  const width = 1920;
  const height = 1080;
  const VIRTUAL_DISPLAY_NAME = 'Sunshine Virtual Display';

  // 1. Performance Optimization (Background Provisioning)
  console.log(cyan('⏳ Provisioning virtual monitor in background...'));

  // Standalone Binary Strategy:
  // We fork the current process with the --daemon-mode flag.
  // Using fork() with process.argv[1] is the standard way to spawn
  // a child that runs the same code in a pkg environment.
  const displayProcess = fork(
    process.argv[1],
    ['--daemon-mode', width.toString(), height.toString(), VIRTUAL_DISPLAY_NAME],
    {
      stdio: ['ignore', 'pipe', 'pipe', 'ipc']
    }
  );
  pm.registerDisplay(displayProcess);

  let displayId: string;

  // Extract the native display ID from the C++ daemon process via IPC messages
  const waitForDisplay = new Promise<string>((resolve, reject) => {
    let isResolved = false;
    let daemonLogs = '';

    displayProcess.on('message', (msg: any) => {
      if (isResolved) return;

      if (msg.type === 'SUCCESS' && msg.id) {
        isResolved = true;
        resolve(msg.id.toString());
      } else if (msg.type === 'ERROR') {
        isResolved = true;
        if (daemonLogs) console.error(red(`\n[Daemon Debug Logs]:\n${daemonLogs}`));
        reject(new Error(msg.message));
      }
    });

    if (displayProcess.stderr) {
      displayProcess.stderr.on('data', (data) => {
        daemonLogs += data.toString();
      });
    }

    displayProcess.on('error', (err) => {
      if (!isResolved) {
        isResolved = true;
        if (daemonLogs) console.error(red(`\n[Daemon Debug Logs]:\n${daemonLogs}`));
        reject(err);
      }
    });

    displayProcess.on('exit', (code) => {
      if (!isResolved) {
        isResolved = true;
        if (code !== 0 && daemonLogs) {
          console.error(red(`\n[Daemon Debug Logs]:\n${daemonLogs}`));
        }
        reject(new Error(`Display daemon exited prematurely with code ${code}`));
      } else {
        if (code !== 0 && code !== null) {
          console.log(yellow(`\n⚠️  Virtual monitor daemon closed (code ${code}).`));
        }
      }
    });

    setTimeout(() => {
      if (!isResolved) {
        isResolved = true;
        reject(new Error('Timeout waiting for monitor initialization.'));
      }
    }, 10000);
  });

  // Check if Headless/CI mode was requested
  const isCiMode = process.argv.includes('--ci');

  const cliConfig = await runInteractiveMenu(isCiMode);

  if (!cliConfig) {
    console.log(red('❌ Operation cancelled.'));
    pm.teardown();
    return;
  }

  const { q, useUsbTethering, connectedDeviceId, enableAudio, autoLaunchMoonlight } = cliConfig;

  console.log(
    green(`\n✅ Resolution: ${width}x${height} | Target Bitrate: ${q.maxBit / 1000}Mbps\n`)
  );

  console.log(cyan('⏳ Finalizing monitor initialization...'));
  try {
    displayId = await waitForDisplay;
    console.log(green(`✅ Monitor initialized natively! (ID: ${displayId})`));
    await new Promise((resolve) => setTimeout(resolve, 1500));
  } catch (err: any) {
    console.error(red(`❌ Error creating monitor: ${err.message}`));
    pm.teardown();
    return;
  }

  console.log(cyan('⚙️  Optimizing Sunshine via ScreenCaptureKit...'));

  const sunshineConfig = generateSunshineConfig(displayId, q.maxBit, enableAudio, useUsbTethering);

  try {
    writeSunshineConfigAtomic(sunshineConfig, SUNSHINE_CONF);
  } catch (err: any) {
    console.error(red(`❌ Error saving configuration: ${err.message}`));
    pm.teardown();
    return;
  }

  console.log(green('🚀 Starting Sunshine...\n'));

  try {
    if (os.platform() === 'darwin') {
      execSync('killall sunshine 2>/dev/null || true');
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  } catch {
    /* Ignore errors */
  }

  const sunshineProcess = spawn(SUNSHINE_BIN, [SUNSHINE_CONF], {
    stdio: 'inherit'
  });
  pm.registerSunshine(sunshineProcess);

  if (useUsbTethering) {
    console.log(cyan('🔌 Starting USB tunnel (Gnirehtet)...'));
    let activeGnirehtet: any = null;
    const startGnirehtet = (isRestart = false) => {
      if (isRestart) {
        console.log(yellow('🔄 Restarting USB tunnel (Gnirehtet)...'));
      }

      const gnirehtetProcess = spawn('gnirehtet', ['run'], {
        stdio: ['ignore', 'pipe', 'pipe']
      });
      activeGnirehtet = gnirehtetProcess;
      pm.registerGnirehtet(gnirehtetProcess);

      if (gnirehtetProcess.stderr) {
        gnirehtetProcess.stderr.on('data', (data) => {
          const msg = data.toString();
          if (msg.includes('Exception') || msg.includes('Error') || msg.includes('fail')) {
            console.error(red(`[Gnirehtet] ${msg.trim()}`));
          }
        });
      }

      gnirehtetProcess.on('exit', (code) => {
        if (!pm.isShuttingDown) {
          console.log(yellow(`\n⚠️  USB tunnel closed unexpectedly (code ${code}). Restarting in 2s...`));
          setTimeout(() => startGnirehtet(true), 2000);
        }
      });
    };

    startGnirehtet();

    console.log(cyan('\n======================================================'));
    console.log(cyan(' ℹ️  USB TUNNEL ACTIVE: Connect Moonlight to IP 10.0.2.2'));
    console.log(cyan('======================================================\n'));

    let isCheckingUsb = false;
    const unplugInterval = setInterval(async () => {
      if (isCheckingUsb) return;
      isCheckingUsb = true;
      try {
        const currentId = await getAdbDeviceId();
        if (!currentId || currentId !== connectedDeviceId) {
          console.log(red('\n🔌 USB cable disconnected. Closing session...'));
          pm.teardown();
        }
      } catch {
        /* Ignore USB polling errors */
      } finally {
        isCheckingUsb = false;
      }
    }, 3000);
    pm.setUsbMonitor(unplugInterval);
  }

  // 4. Moonlight Auto-Launch (If requested)
  if (autoLaunchMoonlight && connectedDeviceId) {
    console.log(cyan('🚀 Launching Moonlight on tablet...'));
    await launchMoonlight(connectedDeviceId);
  }
}
