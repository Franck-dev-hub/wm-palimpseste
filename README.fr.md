<div id="welcome" align="center">

# WikiMasters palimpseste

[English](README.md) | **Français**

Une extension qui réécrit [WikiMasters](https://www.wiki-masters.com) par-dessus, comme un palimpseste.\
Plus d'infos sur les cartes, les tirages et le marché.

![Version](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2FFranck-dev-hub%2Fwm-palimpseste%2Fmain%2Fsrc%2Fmanifest.json&query=%24.version&label=Version&color=blue)
![Manifest](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2FFranck-dev-hub%2Fwm-palimpseste%2Fmain%2Fsrc%2Fmanifest.json&query=%24.manifest_version&label=Manifest&prefix=V&color=blue)
![License](https://img.shields.io/github/license/Franck-dev-hub/wm-palimpseste?label=License)
![CI](https://img.shields.io/github/actions/workflow/status/Franck-dev-hub/wm-palimpseste/ci.yml?label=CI)

![Firefox](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2FFranck-dev-hub%2Fwm-palimpseste%2Fmain%2Fsrc%2Fmanifest.json&query=%24.browser_specific_settings.gecko.strict_min_version&label=Firefox&suffix=%2B&color=FF7139&logo=firefoxbrowser&logoColor=white)
![Chrome](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2FFranck-dev-hub%2Fwm-palimpseste%2Fmain%2Fsrc%2Fmanifest.json&query=%24.minimum_chrome_version&label=Chrome&suffix=%2B&color=4285F4&logo=googlechrome&logoColor=white)

![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
</div>

---

## Principes

- **Fair-play** : l'extension lit et affiche, elle n'automatise aucune fonctionnalité de base.
- **Local** : les données restent dans le navigateur, privées et confidentielles.
- **Non officielle** : non affilié à WikiMasters.

---

## Fonctionnalités

Statut : en développement.

- **Bouton Wikipédia** : une pastille W sur chaque carte ouvre son article Wikipédia dans un nouvel onglet.
- **Étiquettes dans la description** : dans le menu des étiquettes d'une carte, celles citées dans sa description
  ressortent (barre bleue).
- **Étiquette proposée** : le menu des étiquettes propose en tête une étiquette du joueur, marquée d'une ★, seulement sur une carte sans étiquette. Elle est apprise
  des cartes déjà étiquetées, ouvertes ou vues dans la collection, et de leur catégorie Wikidata.

---

## Installation

<details><summary>Firefox (Gecko)</summary>

1. Chercher « palimpseste » sur [addons.mozilla.org](https://addons.mozilla.org/fr/firefox/search/?q=palimpseste).
2. Cliquer sur **Ajouter à Firefox**.

</details>

<details><summary>Chrome, Brave (Chromium)</summary>

1. Chercher « palimpseste » sur le [Chrome Web Store](https://chromewebstore.google.com/search/palimpseste).
2. Cliquer sur **Ajouter à Chrome** (le même bouton dans Brave).

</details>

Ouvrir ensuite [wiki-masters.com](https://www.wiki-masters.com) : l'extension s'active seule.\
Les réglages sont dans la page d'options de l'extension. Les mises à jour sont automatiques.

Développement : voir [CONTRIBUTING.fr.md](CONTRIBUTING.fr.md).

---

## Licence

Le code est sous [AGPL-3.0](LICENSE).\
WikiMasters, Wikipédia, Letterboxd, Babelio et Goodreads sont des marques de leurs propriétaires respectifs.
