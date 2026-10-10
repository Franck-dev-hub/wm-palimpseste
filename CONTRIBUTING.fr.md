# Contribuer

[English](CONTRIBUTING.md) | **Français**

## Prérequis

- [Node.js](https://nodejs.org) 24 (`.nvmrc`).
- [pnpm](https://pnpm.io) 12 : `corepack enable` suffit, le champ `packageManager` de `package.json` fixe la version exacte. Sinon, installer pnpm 12.

## Commandes

```sh
git clone https://github.com/Franck-dev-hub/wm-palimpseste.git
cd wm-palimpseste
pnpm install     # active aussi les hooks Git
pnpm build       # dist/firefox et dist/chromium, sans source maps
pnpm watch       # recompile les deux navigateurs à chaque sauvegarde, source maps incluses
pnpm typecheck   # tsc sur src et scripts
pnpm lint:quick  # typecheck, ESLint, Prettier
pnpm lint        # lint:quick, build, web-ext lint sur dist/firefox
pnpm format      # corrige les fichiers avec Prettier et ESLint
```

**Hooks Git** : `pre-commit` lance `pnpm lint:quick`, `pre-push` lance `pnpm lint`. `--no-verify` les contourne.

Les tests arrivent plus tard.

## Charger l'extension

### Firefox (Gecko)

1. Ouvrir `about:debugging#/runtime/this-firefox`.
2. Cliquer sur **Charger un module complémentaire temporaire** et choisir `dist/firefox/manifest.json`.
3. Ouvrir [wiki-masters.com](https://www.wiki-masters.com).

### Chrome, Brave (Chromium)

1. Ouvrir `brave://extensions` (Chrome : `chrome://extensions`) et activer le **Mode développeur**.
2. Cliquer sur **Charger l'extension non empaquetée** et choisir le dossier `dist/chromium/`.
3. Ouvrir [wiki-masters.com](https://www.wiki-masters.com).

## Recharger

Après une recompilation, cliquer sur **Actualiser** (`about:debugging`) ou sur la flèche de rechargement (`brave://extensions`), puis recharger l'onglet du site.\
Pas de rechargement automatique : Turnstile bloque les navigateurs automatisés sur le site (`web-ext run`, Playwright).\
Firefox oublie un module temporaire à sa fermeture.

## Logs

- Content script : console de la page [wiki-masters.com](https://www.wiki-masters.com).
- Background, Firefox : **Examiner** sur l'extension dans `about:debugging`, puis **Actualiser**, filtre **Informations** actif.
- Background, Chromium : lien **service worker** sur l'extension dans `brave://extensions`, une fois marqué inactif.
- Le background s'arrête quand il est inactif et ne logge qu'à son démarrage.

## Comportement de `pnpm watch`

- Une erreur de syntaxe s'affiche et le watch continue, mais les `.js` disparaissent de `dist/` jusqu'à la correction : un rechargement échoue entre-temps.
- Modifier `src/manifest.json` ou `scripts/build.ts` relance le build : `dist/` est brièvement vide.

## Firefox Android

Déclaré (142+), non testé.
