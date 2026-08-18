import { spawn, execFile, ChildProcess } from 'child_process';
import { promisify } from 'util';
import { green, red, yellow, cyan } from 'kleur/colors';

const execFilePromise = promisify(execFile);

export interface GnirehtetTunnelOptions {
  deviceId?: string | null;
  routes?: string;
  onLog?: (message: string) => void;
  onError?: (error: string) => void;
  onClientConnect?: (clientId: string) => void;
  onClientDisconnect?: (clientId: string) => void;
  onExit?: (code: number | null) => void;
}

/**
 * Attaches a line-buffered reader to a stream to ensure the OS pipe
 * is continuously drained and never deadlocks the child process.
 */
export function attachStreamLineReader(
  stream: NodeJS.ReadableStream | null,
  onLine: (line: string) => void
): void {
  if (!stream) return;
  let buffer = '';

  stream.on('data', (chunk: Buffer | string) => {
    buffer += chunk.toString();
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed) onLine(trimmed);
    }
  });

  stream.on('end', () => {
    const trimmed = buffer.trim();
    if (trimmed) onLine(trimmed);
  });
}

/**
 * Parses Gnirehtet log output and dispatches formatted messages and events.
 */
export function handleGnirehtetLog(line: string, options?: GnirehtetTunnelOptions): void {
  // 1. Client Connected Event
  const connectMatch = line.match(/Client #(\d+) connected/i);
  if (connectMatch) {
    const clientId = connectMatch[1];
    console.log(green(`\n📱 [Gnirehtet] Moonlight client #${clientId} connected over USB tunnel.`));
    options?.onClientConnect?.(clientId);
    return;
  }

  // 2. Client Disconnected Event
  const disconnectMatch = line.match(/Client #(\d+) disconnected/i);
  if (disconnectMatch) {
    const clientId = disconnectMatch[1];
    console.log(
      yellow(`\n⚠️  [Gnirehtet] Moonlight client #${clientId} disconnected from USB tunnel.`)
    );
    options?.onClientDisconnect?.(clientId);
    return;
  }

  // 3. Relay Server Started
  if (line.includes('Starting relay server') || line.includes('Relay server started')) {
    console.log(cyan('🔌 [Gnirehtet] Relay server active (port 31416).'));
    options?.onLog?.(line);
    return;
  }

  // 4. Errors & Exceptions
  if (
    line.includes('ERROR') ||
    line.includes('Exception') ||
    line.includes('fail') ||
    line.includes('os error')
  ) {
    console.error(red(`❌ [Gnirehtet] ${line}`));
    options?.onError?.(line);
    return;
  }

  // 5. Warnings
  if (line.includes('WARN')) {
    console.warn(yellow(`⚠️  [Gnirehtet] ${line}`));
    options?.onLog?.(line);
    return;
  }

  // 6. Generic informational logs
  options?.onLog?.(line);
}

/**
 * Pre-flight cleanup to terminate any lingering Gnirehtet processes or free port 31416.
 */
export async function cleanupStaleGnirehtet(deviceId?: string | null): Promise<void> {
  // Stop Android client VPN if deviceId is provided
  if (deviceId) {
    try {
      await execFilePromise('adb', [
        '-s',
        deviceId,
        'shell',
        'am',
        'force-stop',
        'com.genymobile.gnirehtet'
      ]);
    } catch {
      /* Ignore ADB cleanup errors */
    }
  }

  // Clear any dangling host processes holding port 31416
  try {
    const { stdout } = await execFilePromise('lsof', ['-ti:31416']);
    const pids = stdout.trim().split('\n').filter(Boolean);
    for (const pid of pids) {
      try {
        process.kill(parseInt(pid, 10), 'SIGKILL');
      } catch {
        /* Ignore */
      }
    }
  } catch {
    /* No process holding port 31416 */
  }
}

/**
 * Requests battery optimization exemption on Android for Gnirehtet to prevent
 * the OS from suspending the background VPN service during streaming.
 */
export async function whitelistGnirehtetBattery(deviceId: string): Promise<void> {
  try {
    await execFilePromise('adb', [
      '-s',
      deviceId,
      'shell',
      'dumpsys',
      'deviceidle',
      'whitelist',
      '+com.genymobile.gnirehtet'
    ]);
  } catch {
    /* Ignore if deviceidle whitelist command is unsupported */
  }
}

/**
 * Starts the Gnirehtet reverse tethering tunnel process.
 * Ensures stdout and stderr are continuously drained to prevent OS pipe buffer deadlocks.
 */
export function startGnirehtetTunnel(options: GnirehtetTunnelOptions = {}): ChildProcess {
  const args = ['run'];

  if (options.deviceId) {
    args.push(options.deviceId);
  }

  // Route isolation: default to only route 10.0.2.2 to prevent Android VPN watchdog drops
  const routes = options.routes ?? '10.0.2.2/32';
  args.push('-r', routes);

  const gnirehtetProcess = spawn('gnirehtet', args, {
    stdio: ['ignore', 'pipe', 'pipe']
  });

  const onLine = (line: string) => handleGnirehtetLog(line, options);

  attachStreamLineReader(gnirehtetProcess.stdout, onLine);
  attachStreamLineReader(gnirehtetProcess.stderr, onLine);

  gnirehtetProcess.on('exit', (code) => {
    options.onExit?.(code);
  });

  return gnirehtetProcess;
}

/**
 * Gracefully stops the Gnirehtet tunnel and cleans up both host and Android device resources.
 */
export async function stopGnirehtetTunnel(
  processInstance: ChildProcess | null,
  deviceId?: string | null
): Promise<void> {
  if (processInstance && !processInstance.killed) {
    try {
      processInstance.kill('SIGINT');
      setTimeout(() => {
        if (!processInstance.killed) {
          try {
            processInstance.kill('SIGKILL');
          } catch {
            /* Ignore */
          }
        }
      }, 1500);
    } catch {
      /* Ignore kill error */
    }
  }

  await cleanupStaleGnirehtet(deviceId);
}
