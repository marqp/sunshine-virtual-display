import { execSync } from 'child_process';
import fs from 'fs';

/**
 * Dynamically looks for the Sunshine executable in the system.
 * Ideal for supporting installations via Homebrew, native package (.app), or manual build.
 */
export function findSunshineBin(): string {
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
export function getAdbDeviceId(): string | null {
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
export function hasGnirehtet(): boolean {
  try {
    execSync('which gnirehtet', { encoding: 'utf8' });
    return true;
  } catch {
    return false;
  }
}
