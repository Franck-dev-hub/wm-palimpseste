<div id="welcome" align="center">

# WikiMasters palimpseste

[English](README.md) | **Français**

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

<details><summary>Aide au développement</summary>

Prérequis :

- [Node.js](https://nodejs.org) 24 (`.nvmrc`).
- [pnpm](https://pnpm.io) 12 : `corepack enable` suffit, le champ `packageManager` de `package.json` fixe la version exacte. Sinon, installer pnpm 12.

```sh
git clone https://github.com/Franck-dev-hub/wm-palimpseste.git
cd wm-palimpseste
pnpm install
pnpm build       # dist/firefox et dist/chromium, sans source maps
pnpm watch       # recompile les deux navigateurs à chaque sauvegarde, source maps incluses
pnpm typecheck   # tsc sur src et scripts
```

Lint et tests arrivent plus tard.

**Firefox (Gecko)**

1. Ouvrir `about:debugging#/runtime/this-firefox`.
2. Cliquer sur **Charger un module complémentaire temporaire** et choisir `dist/firefox/manifest.json`.
3. Ouvrir [wiki-masters.com](https://www.wiki-masters.com).

**Chrome, Brave (Chromium)**

1. Ouvrir `brave://extensions` (Chrome : `chrome://extensions`) et activer le **Mode développeur**.
2. Cliquer sur **Charger l'extension non empaquetée** et choisir le dossier `dist/chromium/`.
3. Ouvrir [wiki-masters.com](https://www.wiki-masters.com).

**Recharger**

Après une recompilation, cliquer sur **Actualiser** (`about:debugging`) ou sur la flèche de rechargement (`brave://extensions`), puis recharger l'onglet du site.\
Pas de rechargement automatique : Turnstile bloque les navigateurs automatisés sur le site (`web-ext run`, Playwright).\
Firefox oublie un module temporaire à sa fermeture.

**Logs**

- Content script : console de la page [wiki-masters.com](https://www.wiki-masters.com).
- Background, Firefox : **Examiner** sur l'extension dans `about:debugging`, puis **Actualiser**, filtre **Informations** actif.
- Background, Chromium : lien **service worker** sur l'extension dans `brave://extensions`, une fois marqué inactif.
- Le background s'arrête quand il est inactif et ne logge qu'à son démarrage.

**Comportement de `pnpm watch`**

- Une erreur de syntaxe s'affiche et le watch continue, mais les `.js` disparaissent de `dist/` jusqu'à la correction : un rechargement échoue entre-temps.
- Modifier `src/manifest.json` ou `scripts/build.ts` relance le build : `dist/` est brièvement vide.

**Firefox Android**

Déclaré (142+), non testé.

</details>

---

## Licence

Le code est sous [AGPL-3.0](LICENSE).\
WikiMasters, Wikipédia, Letterboxd, Babelio et Goodreads sont des marques de leurs propriétaires respectifs.
