import { spawn, execSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

import { findSunshineBin, getAdbDeviceId } from './src/utils.js';
import { runInteractiveMenu } from './src/cli.js';
import { generateSunshineConfig } from './src/sunshine.js';

/**
 * Compatibility for hybrid environments (Node.js/Bun) and ES modules (ESM).
 * Resolves __filename and __dirname as they don't exist natively in ESM scope.
 */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SUNSHINE_BIN = findSunshineBin();
const SUNSHINE_CONF = path.join(os.homedir(), '.config/sunshine/sunshine.conf');

let gnirehtetProcess: ReturnType<typeof spawn> | null = null;

async function main() {
  console.clear();
  console.log('=========================================');
  console.log(' ☀️ Sunshine Native Auto-Provision (TS) ☀️ ');
  console.log('=========================================\n');

  let unplugInterval: NodeJS.Timeout | null = null;

  // We fix the resolution at 1080p. Fine-tuning is done via macOS System Settings
  const width = 1920;
  const height = 1080;
  const VIRTUAL_DISPLAY_NAME = 'Sunshine Virtual Display';

  // 1. Performance Optimization (Background Provisioning)
  console.log('⏳ Provisioning virtual monitor in background...');
  const daemonPath = path.join(__dirname, 'display-daemon.js');
  const displayProcess = spawn(
    'node',
    [daemonPath, width.toString(), height.toString(), VIRTUAL_DISPLAY_NAME],
    {
      stdio: ['ignore', 'pipe', 'pipe', 'ipc']
    }
  );

  let displayId: string | null = null;

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
        console.error(`\n❌ Daemon Error: ${msg.message}`);
        if (daemonLogs) console.error(`\n[Daemon Debug Logs]:\n${daemonLogs}`);
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
        if (daemonLogs) console.error(`\n[Daemon Debug Logs]:\n${daemonLogs}`);
        reject(err);
      }
    });

    displayProcess.on('exit', (code) => {
      if (!isResolved) {
        isResolved = true;
        if (code !== 0 && daemonLogs) {
          console.error(`\n[Daemon Debug Logs]:\n${daemonLogs}`);
        }
        reject(new Error(`Display daemon exited prematurely with code ${code}`));
      } else {
        if (code !== 0 && code !== null) {
          console.log(`\n⚠️  Virtual monitor daemon closed (code ${code}).`);
        }
        if (typeof cleanup === 'function') cleanup();
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
    console.log('❌ Operation cancelled.');
    if (displayProcess && !displayProcess.killed) displayProcess.kill('SIGINT');
    process.exit(1);
  }

  const { q, useUsbTethering, connectedDeviceId, enableAudio } = cliConfig;

  console.log(`\n✅ Resolution: ${width}x${height} | Target Bitrate: ${q.maxBit / 1000}Mbps\n`);

  try {
    displayId = await waitForDisplay;
    console.log(`✅ Monitor initialized natively! (CGDirectDisplayID: ${displayId})`);
    await new Promise((resolve) => setTimeout(resolve, 1500));
  } catch (err: any) {
    console.error(`❌ Error creating monitor: ${err.message}`);
    if (displayProcess && !displayProcess.killed) displayProcess.kill('SIGINT');
    process.exit(1);
  }

  console.log('⚙️  Optimizing Sunshine via ScreenCaptureKit...');

  const sunshineConfig = generateSunshineConfig(displayId, q.maxBit, q.sw, enableAudio);

  try {
    const configDir = path.dirname(SUNSHINE_CONF);
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }

    const tempConfigPath = `${SUNSHINE_CONF}.tmp.${Date.now()}`;
    fs.writeFileSync(tempConfigPath, sunshineConfig);
    fs.renameSync(tempConfigPath, SUNSHINE_CONF);
  } catch (err: any) {
    console.error(`❌ Error saving configuration: ${err.message}`);
    if (displayProcess && !displayProcess.killed) displayProcess.kill('SIGINT');
    process.exit(1);
  }

  console.log('🚀 Starting Sunshine...\n');

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

  if (useUsbTethering) {
    console.log('🔌 Starting USB tunnel (Gnirehtet)...');
    gnirehtetProcess = spawn('gnirehtet', ['run'], {
      stdio: ['ignore', 'pipe', 'pipe']
    });

    if (gnirehtetProcess.stderr) {
      gnirehtetProcess.stderr.on('data', (data) => {
        const msg = data.toString();
        if (msg.includes('Exception') || msg.includes('Error') || msg.includes('fail')) {
          console.error(`[Gnirehtet] ${msg.trim()}`);
        }
      });
    }

    console.log('\n======================================================');
    console.log(' ℹ️  USB TUNNEL ACTIVE: Connect Moonlight to IP 10.0.2.2');
    console.log('======================================================\n');

    unplugInterval = setInterval(() => {
      const currentId = getAdbDeviceId();
      if (!currentId || currentId !== connectedDeviceId) {
        console.log('\n🔌 USB cable disconnected. Closing session...');
        cleanup();
      }
    }, 3000);
  }

  let isShuttingDown = false;

  const cleanup = () => {
    if (isShuttingDown) return;
    isShuttingDown = true;

    if (unplugInterval) clearInterval(unplugInterval);

    console.log('\n=========================================');
    console.log(' 🧹 Closing processes and cleaning up... ');
    console.log('=========================================');

    if (gnirehtetProcess && !gnirehtetProcess.killed) {
      console.log('-> Closing USB tunnel (Gnirehtet)...');
      gnirehtetProcess.kill('SIGINT');
    }

    if (sunshineProcess && !sunshineProcess.killed) {
      console.log('-> Requesting Sunshine shutdown...');
      sunshineProcess.kill('SIGTERM');

      setTimeout(() => {
        if (!sunshineProcess.killed) sunshineProcess.kill('SIGKILL');
      }, 2000);
    }

    if (displayProcess && !displayProcess.killed) {
      console.log('-> Destroying native virtual display...');
      displayProcess.kill('SIGINT');
    }

    setTimeout(() => {
      console.log('✅ Done. Goodbye!');
      process.exit(0);
    }, 500);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);

  sunshineProcess.on('exit', () => {
    console.log('\n⚠️  Sunshine has been terminated.');
    cleanup();
  });
}

main().catch((err) => {
  console.error('Unhandled error:', err);
  process.exit(1);
});
