import type { Feature } from '../shared/features';
import { ext } from '../shared/ext';
import { onSettingsChanged, readSettings, setFeature, type Settings } from '../shared/settings';

const byId = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;

function renderRow(feature: Feature): HTMLLIElement {
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.id = `feature-${feature.id}`;
  input.addEventListener('change', () => void setFeature(feature.id, input.checked));

  const name = document.createElement('span');
  name.className = 'name';
  name.textContent = ext.i18n.getMessage(feature.nameKey);

  const description = document.createElement('span');
  description.className = 'description';
  description.textContent = ext.i18n.getMessage(feature.descriptionKey);

  const label = document.createElement('label');
  label.htmlFor = input.id;
  label.append(input, ' ', name, description);

  const row = document.createElement('li');
  row.append(label);
  return row;
}

function applySettings(settings: Settings): void {
  for (const [id, enabled] of Object.entries(settings.features)) {
    byId<HTMLInputElement>(`feature-${id}`).checked = enabled;
  }
}

export async function renderOptions(registry: readonly Feature[]): Promise<() => void> {
  document.documentElement.lang = ext.i18n.getUILanguage();
  for (const element of document.querySelectorAll<HTMLElement>('[data-i18n]')) {
    element.textContent = ext.i18n.getMessage(element.dataset.i18n!);
  }

  byId('empty').hidden = registry.length > 0;
  byId('features').replaceChildren(...registry.map(renderRow));

  // A read started before a change event is stale and would revert the boxes.
  let settled = false;
  const stop = onSettingsChanged(registry, (settings) => {
    settled = true;
    applySettings(settings);
  });
  const initial = await readSettings(registry);
  if (!settled) applySettings(initial);
  return stop;
}
