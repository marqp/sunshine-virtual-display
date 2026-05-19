import fs from 'fs';
import path from 'path';

/**
 * Safely writes the Sunshine configuration file using an atomic rename strategy.
 * This ensures the configuration is either fully written or not written at all,
 * preventing corruption during crashes or interruptions.
 *
 * @param configContent The raw string content of the sunshine.conf
 * @param destPath The final destination path for the config file
 */
export function writeSunshineConfigAtomic(configContent: string, destPath: string): void {
  try {
    const configDir = path.dirname(destPath);

    // Ensure the parent directory exists
    if (!fs.existsSync(configDir)) {
      try {
        fs.mkdirSync(configDir, { recursive: true });
      } catch (err: any) {
        throw new Error(`Failed to create configuration directory "${configDir}": ${err.message}`, {
          cause: err
        });
      }
    }

    // Use a unique temporary filename for the atomic write
    const tempPath = `${destPath}.tmp.${Date.now()}`;

    try {
      fs.writeFileSync(tempPath, configContent, { encoding: 'utf8', mode: 0o600 });
    } catch (err: any) {
      throw new Error(
        `Permission denied: Could not write temporary config to "${tempPath}": ${err.message}`,
        { cause: err }
      );
    }

    try {
      fs.renameSync(tempPath, destPath);
    } catch (err: any) {
      // Clean up the temp file if rename fails
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
      throw new Error(
        `Atomic rename failed: Could not move "${tempPath}" to "${destPath}": ${err.message}`,
        { cause: err }
      );
    }
  } catch (err: any) {
    // Re-throw with clear context if it's already one of our custom errors,
    // otherwise wrap it.
    if (
      err.message.includes('Permission denied') ||
      err.message.includes('Failed to create') ||
      err.message.includes('Atomic rename')
    ) {
      throw err;
    }
    throw new Error(`Critical I/O Error during configuration sync: ${err.message}`, { cause: err });
  }
}
