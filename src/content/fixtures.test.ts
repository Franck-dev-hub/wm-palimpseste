import { describe, expect, it } from 'vitest';
import collection from '../../test/fixtures/collection.html?raw';
import historiqueEchange from '../../test/fixtures/historique-echange.html?raw';
import modale from '../../test/fixtures/modale.html?raw';
import offreEchange from '../../test/fixtures/offre-echange.html?raw';
import revele from '../../test/fixtures/revele.html?raw';

const echange = `div.card-frame button[aria-label="Voir le détail de l'échange"]`;

describe('fixtures', () => {
  // `?raw`, not `fs`: the root tsconfig has no Node types.
  it.each([
    ['collection', collection, 'div[class*="glow-"]:has(h3)'],
    ['revele', revele, 'main [class*="animate-card-flip"]'],
    ['modale', modale, 'div.fixed.inset-0.z-50 > div.card-frame'],
    ['offre-echange', offreEchange, echange],
    ['historique-echange', historiqueEchange, echange],
  ])('%s shows its anchor', (_name, html, anchor) => {
    document.body.innerHTML = html;

    expect(document.querySelector(anchor)).not.toBeNull();
  });
});
