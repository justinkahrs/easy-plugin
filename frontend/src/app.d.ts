import type { JuceRuntime } from '$lib/bridge/juce-runtime';

declare global {
  interface Window {
    __JUCE__?: JuceRuntime;
  }
}

export {};
