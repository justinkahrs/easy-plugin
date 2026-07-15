// GENERATED FILE. DO NOT EDIT.
// Generated from the plugin manifest.

export const stateSchemaVersion = 3 as const;
export const stateFieldIds = {
  "analyzerEnabled": "analyzerEnabled",
  "selectedTab": "selectedTab"
} as const;
export type StateFieldId = (typeof stateFieldIds)[keyof typeof stateFieldIds];
export type StateFieldType = 'boolean' | 'integer' | 'float' | 'string' | 'string-array' | 'number-array' | 'object';
export type StatePersistence = 'plugin' | 'ui';

export interface StateFieldMetadata {
  readonly id: StateFieldId;
  readonly type: StateFieldType;
  readonly persistence: StatePersistence;
  readonly default: unknown;
}

export const stateFieldMetadata = [
  {
    "id": "analyzerEnabled",
    "type": "boolean",
    "persistence": "plugin",
    "default": true
  },
  {
    "id": "selectedTab",
    "type": "string",
    "persistence": "ui",
    "default": "main"
  }
] as const satisfies readonly StateFieldMetadata[];
export const presetConfiguration = {
  "extension": "superfilterpreset",
  "factoryDirectory": "presets/factory",
  "userDirectoryName": "Super Filter",
  "includeUiState": false,
  "categories": [
    "Clean",
    "Creative",
    "Utility"
  ]
} as const;
