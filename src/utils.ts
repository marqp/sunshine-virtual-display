import { exec } from 'child_process';
import { promisify } from 'util';
import { access } from 'fs/promises';

const execPromise = promisify(exec);

/**
 * Dynamically looks for the Sunshine executable in the system.
 * Ideal for supporting installations via Homebrew, native package (.app), or manual build.
 */
export async function findSunshineBin(): Promise<string> {
  // Support custom binary path via environment variable
  if (process.env.SUNSHINE_BIN_PATH) {
    return process.env.SUNSHINE_BIN_PATH;
  }

  try {
    const { stdout } = await execPromise('which sunshine');
    const binPath = stdout.trim();
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
    try {
      await access(p);
      return p;
    } catch {
      /* Continue to next path */
    }
  }

  throw new Error('Sunshine not found. Make sure it is installed or in your $PATH.');
}

/**
 * Detects if there is an Android device connected and authorized via ADB.
 * @returns The device ID or null if no device is found.
 */
export async function getAdbDeviceId(): Promise<string | null> {
  try {
    const { stdout } = await execPromise('adb devices');
    const lines = stdout.trim().split('\n');
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
export async function hasGnirehtet(): Promise<boolean> {
  try {
    await execPromise('which gnirehtet');
    return true;
  } catch {
    return false;
  }
}

/**
 * Checks if the Moonlight app is installed on the given Android device.
 */
export async function isMoonlightInstalled(deviceId: string): Promise<boolean> {
  try {
    const { stdout } = await execPromise(`adb -s ${deviceId} shell pm list packages com.limelight`);
    return stdout.includes('package:com.limelight');
  } catch {
    return false;
  }
}

/**
 * Launches the Moonlight app on the given Android device using the monkey tool.
 */
export async function launchMoonlight(deviceId: string): Promise<void> {
  try {
    await execPromise(
      `adb -s ${deviceId} shell monkey -p com.limelight -c android.intent.category.LAUNCHER 1`
    );
  } catch {
    /* Ignore failures to launch */
  }
}
