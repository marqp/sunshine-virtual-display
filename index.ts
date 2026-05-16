import prompts from 'prompts';
import { spawn, execSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

/**
 * Compatibility for hybrid environments (Node.js/Bun) and ES modules (ESM).
 * Resolves __filename and __dirname as they don't exist natively in ESM scope.
 */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Dynamically looks for the Sunshine executable in the system.
 * Ideal for supporting installations via Homebrew, native package (.app), or manual build.
 */
function findSunshineBin(): string {
  try {
    const binPath = execSync('which sunshine', { encoding: 'utf8' }).trim();
    if (binPath) return binPath;
  } catch {
    /* Ignore if 'which' fails and move to fallbacks */
  }

  const commonPaths = [
    '/opt/homebrew/bin/sunshine',
    '/usr/local/bin/sunshine',
    '/Applications/Sunshine.app/Contents/MacOS/sunshine',
    '/opt/homebrew/opt/sunshine/bin/sunshine'
  ];

  for (const p of commonPaths) {
    if (fs.existsSync(p)) return p;
  }

  throw new Error('Sunshine not found. Make sure it is installed or in your $PATH.');
}

/**
 * Detects if there is an Android device connected and authorized via ADB.
 * @returns The device ID or null if no device is found.
 */
function getAdbDeviceId(): string | null {
  try {
    const output = execSync('adb devices', { encoding: 'utf8' }).trim();
    const lines = output.split('\n');
    // Look for the first line that contains an active and authorized device
    const deviceLine = lines.find((line) => line.includes('\tdevice'));
    if (deviceLine) {
      return deviceLine.split('\t')[0].trim();
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Checks if the gnirehtet binary is installed in the system.
 */
function hasGnirehtet(): boolean {
  try {
    execSync('which gnirehtet', { encoding: 'utf8' });
    return true;
  } catch {
    return false;
  }
}

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

  // 1. Performance Optimization (Background Provisioning)
  // Since the resolution is already known, we trigger the creation of the native virtual screen in parallel.
  // This masks initialization latency while the user reads and chooses menu options.
  console.log('⏳ Provisioning virtual monitor in background...');
  const daemonPath = path.join(__dirname, 'display-daemon.js');
  const displayProcess = spawn('node', [daemonPath, width.toString(), height.toString()], {
    stdio: ['ignore', 'pipe', 'pipe', 'ipc']
  });

  let displayId: string | null = null;

  // Extract the native display ID from the C++ daemon process output (logs)
  const waitForDisplay = new Promise<string>((resolve, reject) => {
    let outputBuffer = '';

    // Flag to prevent late rejections from crashing the parent process
    let isResolved = false;

    const processOutput = (data: Buffer) => {
      if (isResolved) return;
      const chunk = data.toString();
      outputBuffer += chunk;

      const match = outputBuffer.match(/Virtual display created with ID:\s*(\d+)/);
      if (match) {
        isResolved = true;
        resolve(match[1]);
      }
    };

    if (displayProcess.stdout) displayProcess.stdout.on('data', processOutput);
    if (displayProcess.stderr) displayProcess.stderr.on('data', processOutput);

    // Listen for errors emitted by the daemon via IPC channel
    displayProcess.on('message', (msg: any) => {
      if (!isResolved && msg.type === 'ERROR') reject(new Error(msg.message));
    });

    displayProcess.on('error', (err) => {
      if (!isResolved) reject(err);
    });

    displayProcess.on('exit', (code) => {
      // We only consider it an error if it exited before giving us the success ID
      if (!isResolved) {
        reject(new Error(`Display daemon exited prematurely with code ${code}`));
      } else {
        // If the daemon closes *after* being resolved, cleanup will call exit after killing sunshine
        console.log(`\n⚠️  Virtual monitor daemon closed (code ${code}).`);
        if (typeof cleanup === 'function') cleanup();
      }
    });

    // 10s timeout (increased as user might take time in the menu)
    setTimeout(() => {
      if (!isResolved) reject(new Error('Timeout waiting for monitor initialization.'));
    }, 10000);
  });

  // Check if Headless/CI mode was requested (skips interactive menu)
  const isCiMode = process.argv.includes('--ci');
  let q;
  let useUsbTethering = false;
  let connectedDeviceId: string | null = null;

  if (isCiMode) {
    console.log('🤖 --ci mode active. Automatically selecting Balanced profile...');
    q = { minBit: 15000, maxBit: 30000, sw: 'fast' };
  } else {
    // 1.5. USB Tethering Check
    const adbDeviceId = getAdbDeviceId();
    const gnirehtetReady = hasGnirehtet();

    if (adbDeviceId && gnirehtetReady) {
      const tetherResponse = await prompts({
        type: 'confirm',
        name: 'useUsbTethering',
        message:
          '🔌 Android device detected via cable. Enable Turbo USB Mode (Gnirehtet)?',
        initial: true
      });
      useUsbTethering = tetherResponse.useUsbTethering;
      if (useUsbTethering) connectedDeviceId = adbDeviceId;
    } else if (adbDeviceId && !gnirehtetReady) {
      console.log('🔌 Android device detected, but Gnirehtet is not installed.');
      console.log(
        '💡 Tip: Install with `brew install gnirehtet` to enable Turbo USB Mode.\n'
      );
    }

    // 2. Interactive menu for streaming quality selection
    const qualityResponse = await prompts({
      type: 'select',
      name: 'quality',
      message: '✨ Select streaming quality:',
      choices: [
        {
          title: '🎮 Competitive (Ultra Low Latency)',
          value: { minBit: 5000, maxBit: 15000, sw: 'fast' }
        },
        {
          title: '⚖️  Balanced (Smoothness & Clarity)',
          value: { minBit: 15000, maxBit: 30000, sw: 'fast' }
        },
        {
          title: '🍿 Cinematic (Maximum Quality)',
          value: { minBit: 30000, maxBit: 60000, sw: 'medium' }
        }
      ],
      initial: 1
    });

    if (!qualityResponse.quality) {
      console.log('❌ Operation cancelled.');
      if (displayProcess && !displayProcess.killed) displayProcess.kill('SIGINT');
      process.exit(1);
    }

    q = qualityResponse.quality;
  }

  console.log(`\n✅ Resolution: ${width}x${height} | Target Bitrate: ${q.maxBit / 1000}Mbps\n`);

  try {
    // 3. Wait for initialization (if not already ready)
    displayId = await waitForDisplay;
    console.log(`✅ Monitor initialized natively! (CGDirectDisplayID: ${displayId})`);
  } catch (err: any) {
    console.error(`❌ Error creating monitor: ${err.message}`);
    if (displayProcess && !displayProcess.killed) displayProcess.kill('SIGINT');
    process.exit(1);
  }

  // 3. Inject dynamic configuration into sunshine.conf (State of the art on macOS)
  // Associate the stream directly with the newly created Virtual Display
  console.log('⚙️  Optimizing Sunshine via ScreenCaptureKit...');

  // Note: min_bitrate is not supported in recent Sunshine versions. 
  // Bitrates are defined in Kbps.
  const sunshineConfig = [
    `output_name = ${displayId}`,
    `max_bitrate = ${q.maxBit}`,
    `sw_preset = ${q.sw}`,
    `sw_tune = zerolatency`,
    `min_log_level = info`
  ].join('\n');

  try {
    const configDir = path.dirname(SUNSHINE_CONF);
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }

    // Atomic Write:
    // Write to a temp file first and rename to avoid file corruption
    const tempConfigPath = `${SUNSHINE_CONF}.tmp.${Date.now()}`;
    fs.writeFileSync(tempConfigPath, sunshineConfig);
    fs.renameSync(tempConfigPath, SUNSHINE_CONF);
  } catch (err: any) {
    console.error(`❌ Error saving configuration: ${err.message}`);
    if (displayProcess && !displayProcess.killed) displayProcess.kill('SIGINT');
    process.exit(1);
  }

  // 4. Run Sunshine with the newly configured dynamic settings
  console.log('🚀 Starting Sunshine...\n');

  // Kill any existing Sunshine instances to prevent port conflicts or config locks
  try {
    if (os.platform() === 'darwin') {
      execSync('killall sunshine 2>/dev/null || true');
    }
  } catch {
    /* Ignore errors if no process was found */
  }

  const sunshineProcess = spawn(SUNSHINE_BIN, [SUNSHINE_CONF], {
    stdio: 'inherit' // Keep Sunshine logs in the current terminal for user debugging
  });

  if (useUsbTethering) {
    console.log('🔌 Starting USB tunnel (Gnirehtet)...');
    gnirehtetProcess = spawn('gnirehtet', ['run'], {
      stdio: ['ignore', 'pipe', 'pipe']
    });

    if (gnirehtetProcess.stderr) {
      gnirehtetProcess.stderr.on('data', (data) => {
        const msg = data.toString();
        // Log only important Gnirehtet messages to avoid flooding info
        if (msg.includes('Exception') || msg.includes('Error') || msg.includes('fail')) {
          console.error(`[Gnirehtet] ${msg.trim()}`);
        }
      });
    }

    console.log('\n======================================================');
    console.log(' ℹ️  USB TUNNEL ACTIVE: Connect Moonlight to IP 10.0.2.2');
    console.log('======================================================\n');

    /**
     * Hardware Monitoring:
     * Periodically checks if the USB cable was removed or if debugging was disabled.
     * If the device ID disappears or changes, we shut everything down immediately for safety.
     */
    unplugInterval = setInterval(() => {
      const currentId = getAdbDeviceId();
      if (!currentId || currentId !== connectedDeviceId) {
        console.log('\n🔌 USB cable disconnected. Closing session...');
        cleanup();
      }
    }, 3000); // Check every 3 seconds
  }

  // 5. Teardown / Cleanup: Process termination
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
      sunshineProcess.kill('SIGTERM'); // Try graceful shutdown first (Graceful Degradation)

      // Fallback to aggressive SIGKILL if Sunshine hangs longer than 2s
      setTimeout(() => {
        if (!sunshineProcess.killed) sunshineProcess.kill('SIGKILL');
      }, 2000);
    }

    if (displayProcess && !displayProcess.killed) {
      console.log('-> Destroying native virtual display...');
      displayProcess.kill('SIGINT');
    }

    // Give a small delay for processes to die gracefully in the OS
    setTimeout(() => {
      console.log('✅ Done. Goodbye!');
      process.exit(0);
    }, 500);
  };

  // Intercept window closing or Ctrl+C to ensure correct teardown
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);

  // If Sunshine server exits on its own (crash), trigger general cleanup
  sunshineProcess.on('exit', () => {
    console.log('\n⚠️  Sunshine has been terminated.');
    cleanup();
  });
}

main().catch((err) => {
  console.error('Unhandled error:', err);
  process.exit(1);
});
