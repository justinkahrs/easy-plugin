import { get } from 'svelte/store';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { MockBridge } from '$lib/bridge/mock';
import { createVisualizationController, decodeFloat32 } from '$lib/visualization-store';

afterEach(() => {
  vi.useRealTimers();
});

describe('visualization controller', () => {
  it('subscribes to bounded meter/analyzer streams and cleans up timers', async () => {
    vi.useFakeTimers();
    const bridge = new MockBridge('visualization-instance');
    const controller = createVisualizationController(bridge);
    await controller.initialize();

    expect(get(controller.transport)).toMatchObject({ playing: true, bpm: 120 });
    expect(get(controller.meters)).toMatchObject({ sequence: 1, peaks: expect.any(Array) });
    expect(get(controller.analyzer)?.magnitudes).toHaveLength(128);

    const sequence = get(controller.analyzer)?.sequence;
    controller.dispose();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(get(controller.analyzer)?.sequence).toBe(sequence);
    bridge.dispose();
  });

  it('rejects malformed or incorrectly sized packed analyzer data', () => {
    expect(decodeFloat32('not base64', 128)).toBeUndefined();
    expect(decodeFloat32(btoa('short'), 128)).toBeUndefined();
  });
});
