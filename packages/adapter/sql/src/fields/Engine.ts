import ENTRY_FORMAT from '../adapter.schema.json' with { type: 'json' };

/** The engines the format names — the one list, read off the file that states it. */
export type Engine = keyof typeof ENTRY_FORMAT.properties.columnType.properties;
