# Contribuer

[English](CONTRIBUTING.md) | **Français**

## Prérequis

- [Node.js](https://nodejs.org) 24.15 ou plus (`.nvmrc`).
- [pnpm](https://pnpm.io) 12 : `corepack enable`.

## Commandes

```sh
git clone https://github.com/Franck-dev-hub/wm-palimpseste.git
cd wm-palimpseste
pnpm install  # active aussi les hooks Git
pnpm watch    # recompile dist/firefox et dist/chromium à chaque sauvegarde
pnpm lint
pnpm test
pnpm format
```

Les hooks Git et la CI lancent le lint et les tests. Le job `check` de la CI doit passer pour merger dans `main`.

Les tests lisent des captures HTML du site dans `test/fixtures/`.\
La première ligne d'une capture donne son URL et sa date, ou sa source si elle est reconstruite.\
La recapturer quand le site change, sans pseudo réel.

## Charger l'extension

| Navigateur    | Page                                                                       | Action                                                                        |
|---------------|----------------------------------------------------------------------------|-------------------------------------------------------------------------------|
| Firefox       | `about:debugging#/runtime/this-firefox`                                    | **Charger un module complémentaire temporaire**, `dist/firefox/manifest.json` |
| Chrome, Brave | `chrome://extensions` ou `brave://extensions`, **Mode développeur** activé | **Charger l'extension non empaquetée**, `dist/chromium/`                      |

Après une recompilation, recharger l'extension puis l'onglet du site.\
Firefox oublie un module temporaire à sa fermeture.

## Logs

- Content script : console de la page du site.
- Background : **Examiner** dans `about:debugging`, ou le lien **service worker** dans `chrome://extensions`.
