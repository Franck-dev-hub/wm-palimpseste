<div id="welcome" align="center">

# WikiMasters palimpseste

Une extension qui réécrit [WikiMasters](https://www.wiki-masters.com) par-dessus, comme un palimpseste.\
Plus d'infos sur les cartes, les tirages et le marché.

![Version](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2FFranck-dev-hub%2Fwm-palimpseste%2Fmain%2Fsrc%2Fmanifest.json&query=%24.version&label=Version&color=blue)
![Manifest](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2FFranck-dev-hub%2Fwm-palimpseste%2Fmain%2Fsrc%2Fmanifest.json&query=%24.manifest_version&label=Manifest&prefix=V&color=blue)
![License](https://img.shields.io/github/license/Franck-dev-hub/wm-palimpseste?label=License)

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

## Features

Statut : en développement.

---

## Installation

<details><summary>Utilisateur Firefox ou Chromium</summary>

**Firefox**

1. Chercher « palimpseste » sur [addons.mozilla.org](https://addons.mozilla.org/fr/firefox/search/?q=palimpseste).
2. Cliquer sur **Ajouter à Firefox**.

**Chrome, Brave**

1. Chercher « palimpseste » sur le [Chrome Web Store](https://chromewebstore.google.com/search/palimpseste).
2. Cliquer sur **Ajouter à Chrome** (le même bouton dans Brave).

Ouvrir ensuite [wiki-masters.com](https://www.wiki-masters.com) : l'extension s'active seule.\
Les réglages sont dans la page d'options de l'extension. Les mises à jour sont automatiques.

</details>


<details><summary>Aide au développement</summary>

Prérequis : [Node.js](https://nodejs.org) LTS.

```sh
git clone https://github.com/Franck-dev-hub/wm-palimpseste.git
cd wm-palimpseste
npm ci
npm run build   # ou npm run watch : recompile à chaque sauvegarde
```

**Firefox**

1. Ouvrir `about:debugging#/runtime/this-firefox`.
2. Cliquer sur **Charger un module complémentaire temporaire** et choisir `dist/firefox/manifest.json`.
3. Ouvrir [wiki-masters.com](https://www.wiki-masters.com).

**Chrome, Brave**

1. Ouvrir `chrome://extensions` (Brave : `brave://extensions`) et activer le **Mode développeur**.
2. Cliquer sur **Charger l'extension non empaquetée** et choisir le dossier `dist/chromium/`.
3. Ouvrir [wiki-masters.com](https://www.wiki-masters.com).

Après une modification : recharger l'extension (`about:debugging` ou `chrome://extensions`), puis l'onglet du site.\
Firefox oublie un module temporaire à sa fermeture.

Avant de proposer une modification : `npm run lint && npm test`.\
`web-ext run` et Playwright ne fonctionnent pas sur le site : Turnstile bloque les navigateurs automatisés.

</details>

---

## Licence

Le code est sous [AGPL-3.0](LICENSE).\
WikiMasters, Wikipédia, Letterboxd, Babelio et Goodreads sont des marques de leurs propriétaires respectifs.
