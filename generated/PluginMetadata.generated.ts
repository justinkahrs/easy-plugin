// GENERATED FILE. DO NOT EDIT.
// Generated from the plugin manifest.

export interface PluginMetadata {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly manufacturer: Readonly<{
    name: string;
    code: string;
  }>;
  readonly pluginCode: string;
  readonly version: string;
  readonly type: string;
  readonly features: Readonly<{
    presets: boolean;
    transport: boolean;
    meters: boolean;
    analyzer: boolean;
    midi: boolean;
    sidechain: boolean;
  }>;
}

export const pluginMetadata = {
  "id": "com.example.superfilter",
  "name": "Super Filter",
  "description": "Stereo multimode filter",
  "manufacturer": {
    "name": "Example Audio",
    "code": "ExAu"
  },
  "pluginCode": "SpFl",
  "version": "0.1.0",
  "type": "effect",
  "features": {
    "presets": true,
    "transport": true,
    "meters": true,
    "analyzer": true,
    "midi": false,
    "sidechain": false
  }
} as const satisfies PluginMetadata;
