export interface JuceBackend {
  addEventListener(eventId: string, listener: (payload: unknown) => void): [string, number];
  removeEventListener(token: [string, number]): void;
  emitEvent(eventId: string, payload: unknown): void;
}

export interface JuceRuntime {
  backend?: JuceBackend;
  initialisationData?: {
    easyPlugin?: unknown[];
  };
}

