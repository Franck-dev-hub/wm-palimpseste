import { ext } from './ext';

export interface Settings {
  version: 1;
  features: Record<string, boolean>;
}
type Registry = readonly { id: string; default: boolean }[];

const KEY = 'settings';
const VERSION = 1;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const storedFeatures = (raw: unknown): Record<string, unknown> | null =>
  isRecord(raw) && raw.version === VERSION && isRecord(raw.features) ? raw.features : null;

export function parseSettings(raw: unknown, registry: Registry): Settings {
  const stored = storedFeatures(raw);
  const features: Record<string, boolean> = {};
  for (const feature of registry) {
    const value = stored?.[feature.id];
    features[feature.id] = typeof value === 'boolean' ? value : feature.default;
  }
  return { version: VERSION, features };
}

export async function readSettings(registry: Registry): Promise<Settings> {
  const stored = await ext.storage.local.get(KEY);
  return parseSettings(stored[KEY], registry);
}

// A read-modify-write race would drop one of two rapid toggles.
let queue: Promise<void> = Promise.resolve();

async function write(id: string, enabled: boolean): Promise<void> {
  const stored = await ext.storage.local.get(KEY);
  const features = storedFeatures(stored[KEY]) ?? {};
  await ext.storage.local.set({
    [KEY]: { version: VERSION, features: { ...features, [id]: enabled } },
  });
}

export function setFeature(id: string, enabled: boolean): Promise<void> {
  const run = queue.then(() => write(id, enabled));
  queue = run.catch(() => undefined);
  return run;
}

export function onSettingsChanged(
  registry: Registry,
  cb: (settings: Settings) => void,
): () => void {
  const listener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
    if (area !== 'local' || !(KEY in changes)) return;
    cb(parseSettings(changes[KEY].newValue, registry));
  };
  ext.storage.onChanged.addListener(listener);
  return () => ext.storage.onChanged.removeListener(listener);
}
