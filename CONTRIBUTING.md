# Contributing

**English** | [Français](CONTRIBUTING.fr.md)

## Requirements

- [Node.js](https://nodejs.org) 24.15 or later (`.nvmrc`).
- [pnpm](https://pnpm.io) 12: `corepack enable`.

## Commands

```sh
git clone https://github.com/Franck-dev-hub/wm-palimpseste.git
cd wm-palimpseste
pnpm install  # also enables the Git hooks
pnpm watch    # rebuilds dist/firefox and dist/chromium on every save
pnpm lint
pnpm test
pnpm format
```

Git hooks and CI run lint and tests. The CI `check` job must pass to merge into `main`.

Tests read HTML captures of the site from `test/fixtures/`.\
The first line of a capture gives its URL and date, or its source if rebuilt.\
Recapture it when the site changes, with no real player name.

## Load the extension

| Browser       | Page                                                                 | Action                                                  |
|---------------|----------------------------------------------------------------------|---------------------------------------------------------|
| Firefox       | `about:debugging#/runtime/this-firefox`                              | **Load Temporary Add-on**, `dist/firefox/manifest.json` |
| Chrome, Brave | `chrome://extensions` or `brave://extensions`, **Developer mode** on | **Load unpacked**, `dist/chromium/`                     |

After a rebuild, reload the extension then the site tab.\
Firefox forgets a temporary add-on when it closes.

## Logs

- Content script: console of the site page.
- Background: **Inspect** in `about:debugging`, or the **service worker** link in `chrome://extensions`.
