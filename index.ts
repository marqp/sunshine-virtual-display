import { spawn, execSync } from 'child_process';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import ora from 'ora';
import { green, red, yellow, cyan } from 'kleur/colors';

import { findSunshineBin, getAdbDeviceId } from './src/utils.js';
import { runInteractiveMenu } from './src/cli.js';
import { generateSunshineConfig } from './src/sunshine.js';
import { writeSunshineConfigAtomic } from './src/io.js';
import { ProcessManager } from './src/process-manager.js';

/**
 * Compatibility for hybrid environments (Node.js/Bun) and ES modules (ESM).
 * Resolves __filename and __dirname as they don't exist natively in ESM scope.
 */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SUNSHINE_CONF = path.join(os.homedir(), '.config/sunshine/sunshine.conf');

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
  const daemonPath = path.join(__dirname, 'display-daemon.js');
  const displayProcess = spawn(
    'node',
    [daemonPath, width.toString(), height.toString(), VIRTUAL_DISPLAY_NAME],
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
        // Cleanup is handled by ProcessManager via SIGINT/SIGTERM or explicit call
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

  const { q, useUsbTethering, connectedDeviceId, enableAudio } = cliConfig;

  console.log(
    green(`\n✅ Resolution: ${width}x${height} | Target Bitrate: ${q.maxBit / 1000}Mbps\n`)
  );

  const spinner = ora('Finalizing monitor initialization...').start();
  try {
    displayId = await waitForDisplay;
    spinner.succeed(green(`Monitor initialized natively! (ID: ${displayId})`));
    await new Promise((resolve) => setTimeout(resolve, 1500));
  } catch (err: any) {
    spinner.fail(red(`Error creating monitor: ${err.message}`));
    pm.teardown();
    return;
  }

  console.log(cyan('⚙️  Optimizing Sunshine via ScreenCaptureKit...'));

  const sunshineConfig = generateSunshineConfig(displayId, q.maxBit, q.sw, enableAudio);

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
      execSync('sleep 1');
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
    const gnirehtetProcess = spawn('gnirehtet', ['run'], {
      stdio: ['ignore', 'pipe', 'pipe']
    });
    pm.registerGnirehtet(gnirehtetProcess);

    if (gnirehtetProcess.stderr) {
      gnirehtetProcess.stderr.on('data', (data) => {
        const msg = data.toString();
        if (msg.includes('Exception') || msg.includes('Error') || msg.includes('fail')) {
          console.error(red(`[Gnirehtet] ${msg.trim()}`));
        }
      });
    }

    console.log(cyan('\n======================================================'));
    console.log(cyan(' ℹ️  USB TUNNEL ACTIVE: Connect Moonlight to IP 10.0.2.2'));
    console.log(cyan('======================================================\n'));

    const unplugInterval = setInterval(async () => {
      const currentId = await getAdbDeviceId();
      if (!currentId || currentId !== connectedDeviceId) {
        console.log(red('\n🔌 USB cable disconnected. Closing session...'));
        pm.teardown();
      }
    }, 3000);
    pm.setUsbMonitor(unplugInterval);
  }
}

main().catch((err) => {
  console.error(red('Unhandled error:'), err);
  process.exit(1);
});
