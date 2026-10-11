import { onSettingsChanged, readSettings, type Settings } from '../shared/settings';
import type { Start } from './features';

type Registry = readonly { id: string; default: boolean }[];

export function startRunner(registry: Registry, starters: Record<string, Start>): () => void {
  const running = new Map<string, () => void>();

  const startOne = (id: string): void => {
    const start = starters[id];
    if (!start) return;
    try {
      running.set(id, start());
    } catch (error) {
      console.error(`[Palimpseste] ${id}`, error);
    }
  };

  const stopOne = (id: string): void => {
    const stop = running.get(id);
    running.delete(id);
    try {
      stop?.();
    } catch (error) {
      console.error(`[Palimpseste] ${id}`, error);
    }
  };

  const apply = (settings: Settings): void => {
    for (const { id } of registry) {
      const enabled = settings.features[id];
      if (enabled && !running.has(id)) startOne(id);
      else if (!enabled && running.has(id)) stopOne(id);
    }
  };

  let settled = false;
  const unsubscribe = onSettingsChanged(registry, (settings) => {
    settled = true;
    apply(settings);
  });
  void readSettings(registry).then((settings) => {
    if (!settled) apply(settings);
  });

  return () => {
    settled = true;
    unsubscribe();
    for (const id of [...running.keys()]) stopOne(id);
  };
}
