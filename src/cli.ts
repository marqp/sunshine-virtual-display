import prompts from 'prompts';
import { cyan, green, yellow } from 'kleur/colors';
import { getAdbDeviceId, hasGnirehtet, isMoonlightInstalled } from './utils.js';

export interface CliConfig {
  q: { minBit: number; maxBit: number };
  useUsbTethering: boolean;
  connectedDeviceId: string | null;
  enableAudio: boolean;
  isCiMode: boolean;
  autoLaunchMoonlight: boolean;
}

export async function runInteractiveMenu(isCiMode: boolean): Promise<CliConfig | null> {
  let q: CliConfig['q'];
  let useUsbTethering = false;
  let connectedDeviceId: string | null = null;
  let enableAudio = false;
  let autoLaunchMoonlight = false;

  if (isCiMode) {
    console.log(cyan('🤖 --ci mode active.'));

    // 1.5. USB Tethering Check (Automated for CI)
    const adbDeviceId = await getAdbDeviceId();
    const gnirehtetReady = await hasGnirehtet();

    if (adbDeviceId && gnirehtetReady) {
      console.log(
        green('🔌 Android device detected. Automatically enabling Turbo USB Mode (Gnirehtet)...')
      );
      useUsbTethering = true;
      connectedDeviceId = adbDeviceId;

      // Check if Moonlight is present to auto-launch in CI
      if (await isMoonlightInstalled(adbDeviceId)) {
        console.log(cyan('📱 Moonlight detected on tablet. Will open automatically.'));
        autoLaunchMoonlight = true;
      }
    }

    if (useUsbTethering) {
      console.log(cyan('✨ Turbo USB detected: Automatically selecting Cinematic profile...'));
      q = { minBit: 30000, maxBit: 60000 };
    } else {
      console.log(cyan('⚖️  Standard network: Automatically selecting Balanced profile...'));
      q = { minBit: 15000, maxBit: 30000 };
    }
  } else {
    // 1.5. USB Tethering Check
    const adbDeviceId = await getAdbDeviceId();
    const gnirehtetReady = await hasGnirehtet();

    if (adbDeviceId && gnirehtetReady) {
      const tetherResponse = await prompts({
        type: 'confirm',
        name: 'useUsbTethering',
        message: '🔌 Android device detected via cable. Enable Turbo USB Mode (Gnirehtet)?',
        initial: true
      });
      useUsbTethering = tetherResponse.useUsbTethering;
      if (useUsbTethering) {
        connectedDeviceId = adbDeviceId;

        // 1.7. Moonlight Auto-Launch Prompt
        if (await isMoonlightInstalled(adbDeviceId)) {
          const launchResponse = await prompts({
            type: 'confirm',
            name: 'autoLaunchMoonlight',
            message: '📱 Moonlight detected on tablet. Open it automatically?',
            initial: true
          });
          autoLaunchMoonlight = !!launchResponse.autoLaunchMoonlight;
        }
      }
    } else if (adbDeviceId && !gnirehtetReady) {
      console.log(yellow('🔌 Android device detected, but Gnirehtet is not installed.'));
      console.log(
        cyan('💡 Tip: Install with `brew install gnirehtet` to enable Turbo USB Mode.\n')
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
          value: { minBit: 5000, maxBit: 15000 }
        },
        {
          title: '⚖️  Balanced (Smoothness & Clarity)',
          value: { minBit: 15000, maxBit: 30000 }
        },
        {
          title: '🍿 Cinematic (Maximum Quality)',
          value: { minBit: 30000, maxBit: 60000 }
        }
      ],
      initial: 1
    });

    if (!qualityResponse.quality) {
      return null; // Signals cancellation
    }

    q = qualityResponse.quality;

    // 2.5. Audio Sink Toggle
    const audioResponse = await prompts({
      type: 'toggle',
      name: 'enableAudio',
      message: '🔊 Stream Mac audio to tablet?',
      initial: false,
      active: 'yes',
      inactive: 'no'
    });

    if (audioResponse.enableAudio === undefined) {
      return null; // Signals cancellation
    }
    enableAudio = audioResponse.enableAudio;
  }

  return { q, useUsbTethering, connectedDeviceId, enableAudio, isCiMode, autoLaunchMoonlight };
}
