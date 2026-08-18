import { describe, it, expect } from 'vitest';
import { VirtualDisplay } from './virtual-display.js';

describe('VirtualDisplay (src/virtual-display.ts)', () => {
  it('should instantiate VirtualDisplay class', () => {
    const vd = new VirtualDisplay();
    expect(vd).toBeDefined();
    expect(typeof vd.createVirtualDisplay).toBe('function');
    expect(typeof vd.destroyVirtualDisplay).toBe('function');
  });

  it('should validate width and height parameters', () => {
    const vd = new VirtualDisplay();
    expect(() => vd.createVirtualDisplay({ width: 0, height: 1080 })).toThrow(
      'Width must be a positive integer'
    );
    expect(() => vd.createVirtualDisplay({ width: 1920, height: -100 })).toThrow(
      'Height must be a positive integer'
    );
  });

  it('should create display with valid dimensions', () => {
    const vd = new VirtualDisplay();
    const result = vd.createVirtualDisplay({ width: 1920, height: 1080 });
    expect(result).toBeDefined();
    expect(result.width).toBe(1920);
    expect(result.height).toBe(1080);
  });
});
