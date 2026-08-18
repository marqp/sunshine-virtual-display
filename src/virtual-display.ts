import { createRequire } from 'module';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { VIRTUAL_DISPLAY_NODE_BASE64 } from './virtual-display-binary.js';

const require = createRequire(import.meta.url);

export interface VirtualDisplayOptions {
  width: number;
  height: number;
  frameRate?: number;
  hiDPI?: boolean;
  displayName?: string;
  ppi?: number;
  mirror?: boolean;
}

export interface VirtualDisplayInfo {
  id: number;
  width: number;
  height: number;
}

export interface NativeDisplay {
  createVirtualDisplay(
    width: number,
    height: number,
    frameRate: number,
    hiDPI: boolean,
    displayName: string,
    ppi: number,
    mirror: boolean,
    serial: string
  ): VirtualDisplayInfo;

  cloneVirtualDisplay(displayName: string, mirror: boolean): VirtualDisplayInfo;

  destroyVirtualDisplay(): boolean;
}

class MockNativeDisplay implements NativeDisplay {
  createVirtualDisplay(width: number, height: number): VirtualDisplayInfo {
    return {
      id: Math.floor(Math.random() * 1000),
      width,
      height
    };
  }

  cloneVirtualDisplay(): VirtualDisplayInfo {
    return {
      id: Math.floor(Math.random() * 1000),
      width: 1920,
      height: 1080
    };
  }

  destroyVirtualDisplay(): boolean {
    return true;
  }
}

function loadNativeAddon(): { VDisplay: new () => NativeDisplay } {
  if (process.platform !== 'darwin') {
    return { VDisplay: MockNativeDisplay };
  }

  // 1. Extract embedded native addon to tmp and require
  const tmpAddonPath = path.join(os.tmpdir(), 'sunshine_virtual_display_v1.node');
  try {
    const buffer = Buffer.from(VIRTUAL_DISPLAY_NODE_BASE64, 'base64');
    if (!fs.existsSync(tmpAddonPath) || fs.statSync(tmpAddonPath).size !== buffer.length) {
      fs.writeFileSync(tmpAddonPath, buffer, { mode: 0o755 });
    }
    const addon = require(tmpAddonPath);
    if (addon && addon.VDisplay) {
      return addon;
    }
  } catch (err) {
    console.error('Error loading embedded native virtual display addon from tmp:', err);
  }

  // 2. Fallback candidate paths on filesystem
  const candidatePaths = [
    path.join(
      process.cwd(),
      'node_modules/node-mac-virtual-display/build/Release/virtual_display.node'
    ),
    path.join(path.dirname(process.execPath), 'virtual_display.node'),
    path.join(path.dirname(process.execPath), 'build/Release/virtual_display.node')
  ];

  for (const candidate of candidatePaths) {
    try {
      if (fs.existsSync(candidate)) {
        const addon = require(candidate);
        if (addon && addon.VDisplay) {
          return addon;
        }
      }
    } catch {
      /* Continue fallback */
    }
  }

  return { VDisplay: MockNativeDisplay };
}

const addon = loadNativeAddon();

export class VirtualDisplay {
  private addonInstance: NativeDisplay;

  constructor() {
    this.addonInstance = new addon.VDisplay();
  }

  public createVirtualDisplay(options: VirtualDisplayOptions): VirtualDisplayInfo {
    const {
      width,
      height,
      frameRate = 60,
      hiDPI = true,
      displayName = 'Virtual Display',
      ppi = 81,
      mirror = false
    } = options;

    if (!Number.isInteger(width) || width <= 0) {
      throw new Error('Width must be a positive integer');
    }
    if (!Number.isInteger(height) || height <= 0) {
      throw new Error('Height must be a positive integer');
    }

    return this.addonInstance.createVirtualDisplay(
      width,
      height,
      frameRate,
      hiDPI,
      displayName,
      ppi,
      mirror,
      displayName
    );
  }

  public cloneVirtualDisplay(options?: {
    displayName?: string;
    mirror?: boolean;
  }): VirtualDisplayInfo {
    const { displayName = 'Virtual Display', mirror = false } = options || {};
    return this.addonInstance.cloneVirtualDisplay(displayName, mirror);
  }

  public destroyVirtualDisplay(): boolean {
    return this.addonInstance.destroyVirtualDisplay();
  }
}

export default VirtualDisplay;
